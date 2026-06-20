const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseReservationId(raw) {
  const s = String(raw ?? "").trim().replace(/^\{|\}$/g, "");
  if (!s) return null;
  if (UUID_RE.test(s)) return s;
  if (/^\d+$/.test(s)) return s;
  return null;
}

/** Active = can still be cancelled or is in progress */
const ACTIVE_STATUSES = ["confirmed", "checked_in"];

/**
 * @param {import("pg").Pool} pool
 * @param {string} userId
 */
async function getActiveBookings(pool, userId) {
  const r = await pool.query(
    `SELECT id, slot_no, start_time, end_time, status, created_at
     FROM reservations
     WHERE user_id = $1 AND status = ANY($2::text[])
     ORDER BY start_time ASC`,
    [userId, ACTIVE_STATUSES]
  );
  return r.rows.map((row, index) => ({
    id: String(row.id),
    index: index + 1,
    slotNo: row.slot_no,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/** Cancellable = confirmed only (not checked in) */
async function getCancellableBookings(pool, userId) {
  const r = await pool.query(
    `SELECT id, slot_no, start_time, end_time, status
     FROM reservations
     WHERE user_id = $1 AND status = 'confirmed'
     ORDER BY start_time ASC`,
    [userId]
  );
  return r.rows;
}

function formatBookingLine(row, index) {
  const start = new Date(row.start_time).toLocaleString();
  const end = new Date(row.end_time).toLocaleString();
  const idShort = String(row.id).length > 12 ? `${String(row.id).slice(0, 8)}…` : String(row.id);
  return `${index}. Slot ${row.slot_no} — ${start} → ${end} (${row.status}) · ID ${idShort}`;
}

/**
 * @param {import("pg").Pool} pool
 * @param {string} userId
 * @param {string} reservationId
 */
async function cancelBookingForUser(pool, userId, reservationId, logAudit) {
  const id = parseReservationId(reservationId);
  if (!id) {
    return { ok: false, error: "Invalid booking ID.", code: "INVALID_ID" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT id, user_id, slot_no, status FROM reservations WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Booking not found.", code: "NOT_FOUND" };
    }

    const row = r.rows[0];
    if (String(row.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "You can only cancel your own bookings.", code: "FORBIDDEN" };
    }

    if (row.status !== "confirmed") {
      await client.query("ROLLBACK");
      return {
        ok: false,
        error: "Only confirmed bookings (not yet checked in) can be cancelled.",
        code: "INVALID_STATUS",
      };
    }

    await client.query(
      `UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query(
      `UPDATE parking_slots SET state = 0, updated_at = NOW() WHERE slot_no = $1`,
      [row.slot_no]
    );

    await client.query("COMMIT");

    if (logAudit) {
      logAudit(pool, {
        userId,
        action: `CHAT: cancelled booking ${id} (slot ${row.slot_no})`,
        ip: null,
      });
    }

    return {
      ok: true,
      reservationId: String(id),
      slotNo: row.slot_no,
      message: `Booking for slot ${row.slot_no} was cancelled successfully. The bay is now free.`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @param {import("pg").Pool} pool
 * @param {string} userId
 */
async function cancelAllActiveBookingsForUser(pool, userId, logAudit) {
  const rows = await getCancellableBookings(pool, userId);
  if (rows.length === 0) {
    return {
      ok: true,
      cancelledCount: 0,
      message: "You have no active confirmed bookings to cancel.",
    };
  }

  const client = await pool.connect();
  let cancelledCount = 0;
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const locked = await client.query(
        `SELECT id, slot_no, status FROM reservations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [row.id, userId]
      );
      if (locked.rowCount === 0 || locked.rows[0].status !== "confirmed") continue;

      await client.query(
        `UPDATE reservations SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `UPDATE parking_slots SET state = 0, updated_at = NOW() WHERE slot_no = $1`,
        [locked.rows[0].slot_no]
      );
      cancelledCount += 1;
    }

    await client.query("COMMIT");

    if (logAudit && cancelledCount > 0) {
      logAudit(pool, {
        userId,
        action: `CHAT: cancelled ${cancelledCount} booking(s)`,
        ip: null,
      });
    }

    return {
      ok: true,
      cancelledCount,
      message:
        cancelledCount === 1
          ? "1 booking was cancelled successfully."
          : `${cancelledCount} bookings were cancelled successfully.`,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  parseReservationId,
  ACTIVE_STATUSES,
  getActiveBookings,
  getCancellableBookings,
  formatBookingLine,
  cancelBookingForUser,
  cancelAllActiveBookingsForUser,
};
