/**
 * Authenticates physical gate devices (camera + barrier controller) via shared API key.
 * Header: X-Gate-Device-Key: <GATE_DEVICE_API_KEY>
 * Optional: X-Gate-Device-Id: gate-entry-1
 */

function requireGateDeviceApiKey(req, res, next) {
  const expected = process.env.GATE_DEVICE_API_KEY;
  if (!expected || String(expected).trim().length < 16) {
    return res.status(503).json({
      ok: false,
      gateAction: "deny",
      error: "Gate device API is not configured on the server (set GATE_DEVICE_API_KEY in backend/.env).",
      code: "NOT_CONFIGURED",
    });
  }

  const headerKey = req.headers["x-gate-device-key"];
  const auth = req.headers.authorization;
  const bearer = auth && /^Bearer\s+(.+)$/i.test(auth) ? auth.replace(/^Bearer\s+/i, "").trim() : null;
  const provided = String(headerKey || bearer || "").trim();

  if (!provided || provided !== String(expected).trim()) {
    return res.status(401).json({
      ok: false,
      gateAction: "deny",
      error: "Invalid gate device credentials",
      code: "UNAUTHORIZED",
    });
  }

  req.gateDeviceId =
    String(req.headers["x-gate-device-id"] || process.env.GATE_DEVICE_ID || "gate-1").trim() || "gate-1";
  next();
}

module.exports = { requireGateDeviceApiKey };
