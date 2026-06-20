#!/usr/bin/env node
/**
 * ParkGo physical gate agent — runs on the gate controller (e.g. Raspberry Pi).
 *
 * Your QR camera software POSTs the scanned JWT to this agent:
 *   POST http://<gate-pi-ip>:8765/scan  { "qr": "<jwt>" }
 *
 * The agent forwards to ParkGo API POST /gate/device/scan and returns gateAction
 * ("open" | "deny"). Wire GATE_RELAY_OPEN_SCRIPT / GATE_RELAY_DENY_SCRIPT to your
 * barrier relay (GPIO, Modbus, etc.) — camera integration is left to you.
 *
 * Usage:
 *   cp backend/.env.example backend/.env   # set GATE_DEVICE_API_KEY + PARKGO_API_URL
 *   node backend/scripts/gate-device-agent.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const http = require("http");
const https = require("https");
const { URL } = require("url");
const { spawn } = require("child_process");

const AGENT_PORT = Number(process.env.GATE_AGENT_PORT) || 8765;
const AGENT_HOST = process.env.GATE_AGENT_HOST || "0.0.0.0";
const API_BASE = (process.env.PARKGO_API_URL || process.env.GATE_DEVICE_API_URL || "http://127.0.0.1:5000").replace(
  /\/$/,
  ""
);
const DEVICE_KEY = process.env.GATE_DEVICE_API_KEY || "";
const DEVICE_ID = process.env.GATE_DEVICE_ID || "gate-entry-1";
const OPEN_SCRIPT = process.env.GATE_RELAY_OPEN_SCRIPT || "";
const DENY_SCRIPT = process.env.GATE_RELAY_DENY_SCRIPT || "";
const OPEN_PULSE_MS = Number(process.env.GATE_OPEN_PULSE_MS) || 3000;

/** @type {number | null} */
let openPulseTimer = null;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function runRelayScript(scriptPath, label) {
  if (!scriptPath || !String(scriptPath).trim()) {
    console.log(`[gate-agent] ${label} (no script configured — set GATE_RELAY_OPEN_SCRIPT / GATE_RELAY_DENY_SCRIPT)`);
    return;
  }
  console.log(`[gate-agent] ${label}: running ${scriptPath}`);
  const child = spawn(scriptPath, [], { shell: true, stdio: "inherit" });
  child.on("error", (err) => console.error(`[gate-agent] ${label} script error:`, err.message));
}

function triggerGate(action) {
  if (action === "open") {
    runRelayScript(OPEN_SCRIPT, "OPEN gate");
    if (openPulseTimer) clearTimeout(openPulseTimer);
    openPulseTimer = setTimeout(() => {
      console.log("[gate-agent] open pulse ended");
      openPulseTimer = null;
    }, OPEN_PULSE_MS);
    return;
  }
  runRelayScript(DENY_SCRIPT, "DENY gate");
}

function postToParkGoApi(path, payload) {
  const url = new URL(`${API_BASE}${path}`);
  const body = JSON.stringify(payload);
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Gate-Device-Key": DEVICE_KEY,
          "X-Gate-Device-Id": DEVICE_ID,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = { ok: false, error: "Invalid JSON from ParkGo API", raw: data };
          }
          resolve({ status: res.statusCode || 500, data: parsed });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("ParkGo API request timed out"));
    });
    req.write(body);
    req.end();
  });
}

async function handleScan(qr) {
  if (!DEVICE_KEY || DEVICE_KEY.length < 16) {
    return {
      status: 503,
      data: {
        ok: false,
        gateAction: "deny",
        error: "GATE_DEVICE_API_KEY not set in gate agent .env (min 16 chars)",
        code: "NOT_CONFIGURED",
      },
    };
  }

  const trimmed = String(qr || "").trim();
  if (!trimmed) {
    return {
      status: 400,
      data: { ok: false, gateAction: "deny", error: 'Field "qr" is required', code: "MISSING" },
    };
  }

  console.log(`[gate-agent] scan received (${trimmed.length} chars) → ${API_BASE}/gate/device/scan`);
  const upstream = await postToParkGoApi("/gate/device/scan", { qr: trimmed });
  const result = upstream.data || { ok: false, gateAction: "deny", error: "Empty API response" };

  if (result.gateAction === "open") {
    triggerGate("open");
  } else {
    triggerGate("deny");
  }

  return { status: upstream.status, data: result };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      return sendJson(res, 200, {
        ok: true,
        service: "parkgo-gate-agent",
        deviceId: DEVICE_ID,
        apiBase: API_BASE,
        timestamp: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && req.url === "/scan") {
      const body = await readJsonBody(req);
      const { status, data } = await handleScan(body.qr);
      return sendJson(res, status, data);
    }

    sendJson(res, 404, { ok: false, error: "Not found. Use GET /health or POST /scan { qr }" });
  } catch (err) {
    console.error("[gate-agent] request error:", err.message);
    sendJson(res, 500, { ok: false, gateAction: "deny", error: err.message });
  }
});

server.listen(AGENT_PORT, AGENT_HOST, () => {
  console.log(
    `[gate-agent] listening on http://${AGENT_HOST}:${AGENT_PORT}\n` +
      `  Camera → POST /scan { "qr": "<jwt>" }\n` +
      `  ParkGo API → ${API_BASE}/gate/device/scan\n` +
      `  Device ID → ${DEVICE_ID}\n` +
      `  Relay open script → ${OPEN_SCRIPT || "(not set)"}`
  );
});
