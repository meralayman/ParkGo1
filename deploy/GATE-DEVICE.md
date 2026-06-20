# Physical gate camera integration

ParkGo links **user QR codes** (web + mobile app) to a **physical gate** via a small agent on the gate controller. You only need to wire your QR camera to POST the scanned token to the agent.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ User phone      │     │ Gate controller  │     │ ParkGo backend      │
│ (web / mobile)  │     │ (Raspberry Pi)   │     │ (Node API)          │
│                 │     │                  │     │                     │
│ Shows booking   │     │ gate-device-     │     │ POST /gate/device/  │
│ QR (signed JWT) │────►│ agent.js         │────►│ scan                │
│                 │scan │ POST /scan       │     │ validate + check-in │
└─────────────────┘     │                  │     │ or check-out        │
                        │ open relay ◄─────┼─────┤ gateAction: open    │
                        └──────────────────┘     └─────────────────────┘
```

| Layer | Role |
|-------|------|
| **Website** (`UserDashboard`) | Renders signed `qrJwt` after booking (card or Paymob). |
| **Mobile app** (`QrCodeScreen`) | Same JWT in `react-native-qrcode-svg`. |
| **Backend** | `POST /gate/device/scan` — one call: validate QR → check-in **or** check-out → `gateAction: "open"` / `"deny"`. |
| **Gate agent** (`backend/scripts/gate-device-agent.js`) | Local HTTP server; forwards scans to backend; runs relay scripts. |
| **Your camera** | Detect QR → `POST http://<gate-pi>:8765/scan` with `{ "qr": "<jwt>" }`. **You implement this.** |

Manual gatekeeper flows (web `/gatekeeper`, mobile gatekeeper tabs) still use `POST /gate/qr/preview` + separate check-in/out buttons.

## 1. Backend configuration

In `backend/.env`:

```env
GATE_DEVICE_API_KEY=your-long-random-secret-min-16-chars
GATE_DEVICE_ID=gate-entry-1
JWT_SECRET=...   # must match production; used to sign booking QRs
```

Restart the API after changes.

## 2. Gate controller (agent)

On the machine next to the barrier (same host as the camera software):

```bash
cd backend
cp .env.example .env   # if needed — set GATE_DEVICE_API_KEY and PARKGO_API_URL
npm run gate-agent
```

Agent environment (`backend/.env` on the Pi):

```env
PARKGO_API_URL=https://your-parkgo-server.com
GATE_DEVICE_API_KEY=same-as-backend
GATE_DEVICE_ID=gate-entry-1
GATE_AGENT_PORT=8765
GATE_RELAY_OPEN_SCRIPT=/opt/parkgo/open-barrier.sh
GATE_RELAY_DENY_SCRIPT=/opt/parkgo/deny-beep.sh
GATE_OPEN_PULSE_MS=3000
```

### Agent endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/health` | — | Agent status |
| `POST` | `/scan` | `{ "qr": "<jwt string>" }` | Same as backend `/gate/device/scan` |

Example (curl from camera test):

```bash
curl -s -X POST http://127.0.0.1:8765/scan \
  -H "Content-Type: application/json" \
  -d '{"qr":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

Success (entry):

```json
{
  "ok": true,
  "gateAction": "open",
  "action": "check-in",
  "message": "Checked in — gate may open for entry",
  "bookingId": "42",
  "slotNo": "A-12"
}
```

Denied:

```json
{
  "ok": false,
  "gateAction": "deny",
  "error": "This QR code has expired",
  "code": "EXPIRED"
}
```

## 3. Camera integration (your work)

Point your QR reader at the agent:

1. Camera reads QR from the user's phone screen.
2. Camera software sends the **raw JWT string** (three dot-separated base64 parts) to:
   - `POST http://<gate-controller-ip>:8765/scan`
   - JSON body: `{ "qr": "<scanned text>" }`
3. Agent calls ParkGo API and returns `gateAction`.
4. On `"open"`, agent runs `GATE_RELAY_OPEN_SCRIPT` (GPIO, Modbus, etc.).
5. On `"deny"`, agent runs `GATE_RELAY_DENY_SCRIPT` (optional buzzer/LED).

### Camera software examples

- **Python + OpenCV/pyzbar**: on decode, `requests.post("http://127.0.0.1:8765/scan", json={"qr": data})`
- **IP camera with HTTP webhook**: configure webhook URL to agent `/scan` with QR in JSON body
- **USB scanner (keyboard wedge)**: small local script that reads stdin and POSTs to `/scan`

Debounce: ignore the same QR for ~4 seconds (mobile gatekeeper app uses 4s cooldown).

## 4. Direct API (skip agent)

Cameras with HTTPS and secure storage can call the backend directly:

```bash
curl -s -X POST https://api.example.com/gate/device/scan \
  -H "Content-Type: application/json" \
  -H "X-Gate-Device-Key: $GATE_DEVICE_API_KEY" \
  -H "X-Gate-Device-Id: gate-entry-1" \
  -d '{"qr":"<jwt>"}'
```

Health check: `GET /gate/device/health` with the same headers.

## 5. Relay scripts (barrier)

Example `open-barrier.sh` (replace with your hardware):

```bash
#!/bin/sh
# Raspberry Pi GPIO example — adapt to your relay board
echo 1 > /sys/class/gpio/gpio17/value
sleep 3
echo 0 > /sys/class/gpio/gpio17/value
```

Set executable and path in `GATE_RELAY_OPEN_SCRIPT`.

## 6. End-to-end test (no camera)

1. Book parking on web or mobile; copy the QR JWT from devtools or the QR screen debug text.
2. Start backend + agent.
3. `curl -X POST http://127.0.0.1:8765/scan -H "Content-Type: application/json" -d '{"qr":"..."}'`
4. Confirm `gateAction: "open"` and reservation status `checked_in` in the dashboard.
5. Scan same QR again → `check-out` and status `closed`.

## Security notes

- Keep `GATE_DEVICE_API_KEY` secret; rotate if leaked.
- Use HTTPS for `PARKGO_API_URL` in production.
- Gate device routes are rate-limited (120/min per IP).
- Audit events appear in admin logs as `GATE_DEVICE[gate-entry-1]: ...`.

## Related files

| File | Purpose |
|------|---------|
| `backend/services/gateAccess.service.js` | QR validation + check-in/out logic |
| `backend/routes/gateDevice.routes.js` | `/gate/device/scan`, `/gate/device/health` |
| `backend/middleware/gateDeviceAuth.js` | API key auth |
| `backend/scripts/gate-device-agent.js` | Local agent for camera → API → relay |
| `src/api/gateApi.js` | `gateDeviceScan()` for testing |
| `src/pages/UserDashboard.js` | User QR display (web) |
| `mobile-app/src/screens/user/QrCodeScreen.js` | User QR display (mobile) |
