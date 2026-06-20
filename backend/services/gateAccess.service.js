/**
 * Shared gate access logic: QR preview, check-in, check-out, and automated device scans.
 * Used by manual gatekeeper routes and physical gate camera devices.
 */

const { verifyBookingQrDetailed, resolveQrExpiresAt } = require("../qrJwt");
const {
  tieredBookingTotalEgp,
  billableHoursFromDurationHours,
  effectiveAverageHourlyEgp,
  firstHourEgpForPeakLevel,
  EXTRA_PER_HOUR_EGP,
} = require("../parkingPricing");
const { peakInfo } = require("../smartParking");

const MS_PER_HOUR = 60 * 60 * 1000;
const OVERSTAY_HOURLY_RATE = Number(process.env.OVERSTAY_HOURLY_RATE) || EXTRA_PER_HOUR_EGP();

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function storedDynamicHourly(row) {
  if (!row) return null;
  const v = row.dynamic_hourly_rate != null ? Number(row.dynamic_hourly_rate) : NaN;
  if (Number.isFinite(v) && v > 0) return v;
  return null;
}

function lateOverstayHourlyRate(row) {
  return storedDynamicHourly(row) ?? OVERSTAY_HOURLY_RATE;
}

function computeCheckoutAmounts(row, checkOutAt) {
  const ci = new Date(row.check_in_time);
  const end = new Date(row.end_time);
  const co = new Date(checkOutAt);
  const lateHr = lateOverstayHourlyRate(row);
  const dyn = storedDynamicHourly(row);

  const endBoundaryMs = Math.min(co.getTime(), end.getTime());
  const spanMs = Math.max(0, endBoundaryMs - ci.getTime());
  const baseDurationHours = spanMs / MS_PER_HOUR;
  const baseHours = billableHoursFromDurationHours(baseDurationHours);
  const peakForTariff = peakInfo(new Date(row.start_time));
  const firstHrEgp = firstHourEgpForPeakLevel(peakForTariff.peakLevel);
  const baseAmount = tieredBookingTotalEgp(baseDurationHours, firstHrEgp);
  const baseHrDisplay = effectiveAverageHourlyEgp(baseDurationHours, firstHrEgp);

  let lateHours = 0;
  let lateFeeAmount = 0;
  if (co.getTime() > end.getTime()) {
    const lateMs = co.getTime() - end.getTime();
    lateHours = Math.ceil(lateMs / MS_PER_HOUR);
    lateFeeAmount = roundMoney(lateHours * lateHr);
  }

  return {
    baseAmount,
    baseHours,
    lateFeeAmount,
    lateHours,
    lateFeeApplied: lateFeeAmount > 0,
    totalAmount: roundMoney(baseAmount + lateFeeAmount),
    dynamicHourlyRate: dyn,
    baseHourlyRate: baseHrDisplay,
    lateHourlyRate: lateHr,
  };
}

function bookingNextAction(status) {
  if (status === "confirmed") return "check-in";
  if (status === "checked_in") return "check-out";
  return null;
}

function sanitizeReservation(row) {
  if (!row) return null;
  const safe = { ...row };
  delete safe.qr_token;
  return safe;
}

/**
 * @param {import("pg").Pool} pool
 * @param {{ arrivalWindowMinutes?: number, earlyCheckInMinutes?: number }} [options]
 */
function createGateAccessService(pool, options = {}) {
  const ARRIVAL_WINDOW_MINUTES =
    options.arrivalWindowMinutes ?? (Number(process.env.ARRIVAL_WINDOW_MINUTES) || 20);
  const EARLY_CHECKIN_MINUTES =
    options.earlyCheckInMinutes ?? (Number(process.env.EARLY_CHECKIN_MINUTES) || 60);

  async function sweepNoShows(client) {
    const swept = await client.query(
      `UPDATE reservations
       SET status = 'cancelled'
       WHERE status = 'confirmed'
         AND NOW() > start_time + ($1 * INTERVAL '1 minute')
       RETURNING slot_no`,
      [ARRIVAL_WINDOW_MINUTES]
    );
    for (const row of swept.rows) {
      await client.query(
        `UPDATE parking_slots SET state = 0, updated_at = NOW() WHERE slot_no = $1`,
        [row.slot_no]
      );
    }
  }

  async function runNoShowSweep() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await sweepNoShows(client);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validate QR JWT and load reservation (no status change).
   * @returns {Promise<{ ok: true, reservation: object, nextAction: string | null } | { ok: false, error: string, code?: string, httpStatus?: number }>}
   */
  async function previewQr(rawQr) {
    const raw = String(rawQr ?? "").trim();
    if (!raw) {
      return { ok: false, error: 'Field "qr" with the scanned token is required', code: "MISSING", httpStatus: 400 };
    }

    const v = verifyBookingQrDetailed(raw);
    if (!v.ok) {
      const code = v.code || "INVALID";
      return {
        ok: false,
        error: v.error,
        code,
        httpStatus: code === "EXPIRED" ? 401 : 400,
      };
    }

    const { bookingId, userId, jti, isSimpleReservationQr } = v.payload;
    await runNoShowSweep();

    const r = await pool.query(
      `SELECT id, user_id, slot_no, start_time, end_time, status, payment_method, total_amount,
              check_in_time, check_out_time, qr_token, created_at, qr_expires_at, dynamic_hourly_rate
       FROM reservations WHERE id = $1`,
      [bookingId]
    );

    if (r.rowCount === 0) {
      return { ok: false, error: "Booking not found", code: "NOT_FOUND", httpStatus: 404 };
    }

    const reservation = r.rows[0];

    if (!isSimpleReservationQr) {
      if (String(reservation.user_id) !== String(userId)) {
        return { ok: false, error: "Invalid QR code (user mismatch)", code: "MISMATCH", httpStatus: 400 };
      }
      if (reservation.qr_token == null || String(reservation.qr_token) !== jti) {
        return {
          ok: false,
          error: "This QR code is no longer valid (already used or revoked)",
          code: "USED_OR_REVOKED",
          httpStatus: 400,
        };
      }
    }

    const effectiveExp = resolveQrExpiresAt(reservation);
    if (!effectiveExp) {
      return {
        ok: false,
        error: "Booking has no valid QR expiration (missing end time)",
        code: "NO_EXPIRY",
        httpStatus: 400,
      };
    }
    if (effectiveExp.getTime() < Date.now()) {
      return { ok: false, error: "This QR code has expired", code: "EXPIRED", httpStatus: 401 };
    }

    if (["closed", "cancelled", "no_show"].includes(reservation.status)) {
      return {
        ok: false,
        error: `This booking is ${reservation.status}. Further scans are not allowed.`,
        code: "INACTIVE",
        httpStatus: 400,
      };
    }

    return {
      ok: true,
      reservation: sanitizeReservation(reservation),
      nextAction: bookingNextAction(reservation.status),
      bookingId: String(reservation.id),
    };
  }

  /**
   * @param {string | number} bookingId
   */
  async function checkIn(bookingId) {
    const id = String(bookingId ?? "").trim();
    if (!id) {
      return { ok: false, error: "bookingId is required", httpStatus: 400 };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await sweepNoShows(client);

      const r = await client.query(
        `SELECT id, user_id, slot_no, status, start_time, end_time, check_in_time
         FROM reservations WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Booking not found", httpStatus: 404 };
      }

      const row = r.rows[0];

      if (row.status === "checked_in") {
        await client.query("ROLLBACK");
        return { ok: false, error: "Already checked in — use check-out for exit.", httpStatus: 400 };
      }

      if (row.status !== "confirmed") {
        await client.query("ROLLBACK");
        return { ok: false, error: `Check-in not allowed (status: ${row.status})`, httpStatus: 400 };
      }

      const now = new Date();
      const start = new Date(row.start_time);
      const earliest = new Date(start.getTime() - EARLY_CHECKIN_MINUTES * 60 * 1000);
      const latest = new Date(start.getTime() + ARRIVAL_WINDOW_MINUTES * 60 * 1000);

      if (now < earliest) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: `Too early for check-in. Earliest: ${earliest.toISOString()}`,
          httpStatus: 400,
        };
      }
      if (now > latest) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: `Check-in window ended (${ARRIVAL_WINDOW_MINUTES} min after your scheduled start). The reservation may have been cancelled and the slot released.`,
          httpStatus: 400,
        };
      }

      await client.query(
        `UPDATE reservations SET status = 'checked_in', check_in_time = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(
        `UPDATE parking_slots SET state = 1, updated_at = NOW() WHERE slot_no = $1`,
        [row.slot_no]
      );
      await client.query("COMMIT");

      return {
        ok: true,
        action: "check-in",
        message: "Checked in — gate may open for entry",
        bookingId: id,
        slotNo: row.slot_no,
        userId: row.user_id != null ? String(row.user_id) : null,
        checkInTime: new Date().toISOString(),
        gateAction: "open",
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * @param {string | number} bookingId
   */
  async function checkOut(bookingId) {
    const id = String(bookingId ?? "").trim();
    if (!id) {
      return { ok: false, error: "bookingId is required", httpStatus: 400 };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await sweepNoShows(client);

      const r = await client.query(
        `SELECT id, user_id, slot_no, status, start_time, end_time, check_in_time, check_out_time,
                total_amount, dynamic_hourly_rate
         FROM reservations WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (r.rowCount === 0) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Booking not found", httpStatus: 404 };
      }

      const row = r.rows[0];

      if (row.status === "closed") {
        await client.query("ROLLBACK");
        return { ok: false, error: "Booking already closed. Scan rejected.", httpStatus: 400 };
      }

      if (row.status !== "checked_in") {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "Check-out only after check-in. Current status: " + row.status,
          httpStatus: 400,
        };
      }

      if (!row.check_in_time) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Missing check-in time", httpStatus: 400 };
      }

      const co = new Date();
      const amounts = computeCheckoutAmounts(row, co);

      await client.query(
        `UPDATE reservations
         SET status = 'closed',
             check_out_time = NOW(),
             total_amount = $1,
             late_fee_applied = $2,
             late_fee_amount = $3
         WHERE id = $4`,
        [amounts.totalAmount, amounts.lateFeeApplied, amounts.lateFeeAmount, id]
      );
      await client.query(
        `UPDATE parking_slots SET state = 0, updated_at = NOW() WHERE slot_no = $1`,
        [row.slot_no]
      );
      await client.query("COMMIT");

      return {
        ok: true,
        action: "check-out",
        message: "Checked out — booking closed (paid total calculated)",
        bookingId: id,
        slotNo: row.slot_no,
        userId: row.user_id != null ? String(row.user_id) : null,
        checkOutTime: co.toISOString(),
        gateAction: "open",
        ...amounts,
        paid: true,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Single call for physical gate cameras: validate QR then auto check-in or check-out.
   * @param {string} rawQr
   * @param {{ deviceId?: string }} [meta]
   */
  async function processDeviceScan(rawQr, meta = {}) {
    const preview = await previewQr(rawQr);
    if (!preview.ok) {
      return {
        ok: false,
        gateAction: "deny",
        error: preview.error,
        code: preview.code,
        httpStatus: preview.httpStatus || 400,
        deviceId: meta.deviceId || null,
      };
    }

    const { reservation, nextAction, bookingId } = preview;

    if (!nextAction) {
      return {
        ok: false,
        gateAction: "deny",
        error: `No gate action for booking status: ${reservation.status}`,
        code: "NO_ACTION",
        reservation,
        httpStatus: 400,
        deviceId: meta.deviceId || null,
      };
    }

    let result;
    if (nextAction === "check-in") {
      result = await checkIn(bookingId);
    } else if (nextAction === "check-out") {
      result = await checkOut(bookingId);
    } else {
      return {
        ok: false,
        gateAction: "deny",
        error: "Unknown next action",
        code: "NO_ACTION",
        reservation,
        httpStatus: 400,
        deviceId: meta.deviceId || null,
      };
    }

    if (!result.ok) {
      return {
        ok: false,
        gateAction: "deny",
        error: result.error,
        nextAction,
        reservation,
        httpStatus: result.httpStatus || 400,
        deviceId: meta.deviceId || null,
      };
    }

    return {
      ...result,
      ok: true,
      reservation: sanitizeReservation(reservation),
      nextAction,
      deviceId: meta.deviceId || null,
    };
  }

  return {
    previewQr,
    checkIn,
    checkOut,
    processDeviceScan,
    bookingNextAction,
    sweepNoShows,
    runNoShowSweep,
  };
}

module.exports = {
  createGateAccessService,
  bookingNextAction,
  computeCheckoutAmounts,
};
