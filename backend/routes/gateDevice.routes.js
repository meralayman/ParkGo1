const { requireGateDeviceApiKey } = require("../middleware/gateDeviceAuth");
const { gateDeviceRateLimiter } = require("../middleware/rateLimits");
const { clientIp } = require("../auditLog");
const { createGateAccessService } = require("../services/gateAccess.service");

/**
 * Physical gate device routes — for camera/barrier hardware at the parking entrance.
 * Camera software POSTs the scanned QR JWT; server validates and auto check-in/out.
 *
 * @param {import("express").Express} app
 * @param {object} deps
 */
function registerGateDeviceRoutes(app, { pool, apiError, logAudit }) {
  const gateAccess = createGateAccessService(pool);

  app.get("/gate/device/health", requireGateDeviceApiKey, (_req, res) => {
    res.json({
      ok: true,
      service: "parkgo-gate-device",
      deviceId: _req.gateDeviceId,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Automated gate scan — validate QR and perform check-in or check-out in one step.
   * POST { "qr": "<jwt from user's phone screen>" }
   * Response includes gateAction: "open" | "deny" for the barrier relay.
   */
  app.post("/gate/device/scan", requireGateDeviceApiKey, gateDeviceRateLimiter, async (req, res) => {
    const raw = req.body && req.body.qr;
    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return res.status(400).json({
        ok: false,
        gateAction: "deny",
        error: 'Field "qr" with the scanned token is required',
        code: "MISSING",
      });
    }

    try {
      const result = await gateAccess.processDeviceScan(raw.trim(), {
        deviceId: req.gateDeviceId,
      });

      if (result.ok && result.userId) {
        logAudit(pool, {
          userId: result.userId,
          action: `GATE_DEVICE[${req.gateDeviceId}]: ${result.action} for booking ${result.bookingId} (slot ${result.slotNo})`,
          ip: clientIp(req),
        });
      } else if (!result.ok && result.reservation?.user_id) {
        logAudit(pool, {
          userId: String(result.reservation.user_id),
          action: `GATE_DEVICE[${req.gateDeviceId}]: DENY — ${result.error || "scan rejected"}`,
          ip: clientIp(req),
        });
      }

      const status = result.httpStatus || (result.ok ? 200 : 400);
      const body = { ...result };
      delete body.httpStatus;
      return res.status(status).json(body);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        gateAction: "deny",
        error: apiError(err),
        code: "SERVER_ERROR",
      });
    }
  });
}

module.exports = { registerGateDeviceRoutes };
