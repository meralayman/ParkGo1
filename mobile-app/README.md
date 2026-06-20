# ParkGo Mobile (Expo React Native)

This is the **mobile client** for ParkGo. It connects to the **same Express backend** and **same PostgreSQL database** (no DB duplication).

## Requirements

- Node.js 18+ recommended
- Expo Go on your phone, or Android Studio emulator
- ParkGo backend running (default `http://localhost:5000`)

## Configure API Base URL

Expo uses **public env vars**:

1. Copy `mobile-app/.env.example` to `mobile-app/.env` and set your PC’s Wi‑Fi IPv4:

```
EXPO_PUBLIC_API_LAN_HOST=192.168.1.62
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.62:5000
```

- **Expo Go on a real phone (iPhone/Android)**: set `EXPO_PUBLIC_API_LAN_HOST` to your PC LAN IP (`ipconfig` on Windows).
- **Android emulator**: uses `http://10.0.2.2:5000` automatically (do not use the LAN IP on the emulator). Run `npm run open:android` after Metro starts so `adb reverse` maps port 5000.
- **iOS simulator (macOS)**: `http://127.0.0.1:5000` or omit LAN host

Important:
- `http://10.0.2.2:5000` works **only** on an Android emulator — not on iPhone.
- Phone and PC must be on the **same Wi‑Fi**. Allow inbound TCP **5000** in Windows Firewall if requests still time out.
- After editing `.env`, restart Expo with cache clear: `npx expo start -c`

## Install

```bash
cd mobile-app
npm install
```

## Run

From the repo root:

```bash
cd mobile-app
npx expo start
```

(If your terminal is already in `mobile-app`, do **not** run `cd mobile-app` again.)

Then:

- **Physical phone:** scan the QR with **Expo Go**
- **Android emulator:** prefer `npm run open:android` in a **second** terminal (see below). Pressing `a` in Expo can fail after it reinstalls Expo Go (`host.exp.exponent` / `LAUNCHER` error).

### Android emulator (recommended)

Expo’s **`a` key** opens `exp://192.168.x.x:PORT`, which often **hangs on a white loading screen** in the emulator. Use **`--localhost`** and the helper script instead:

1. Start the AVD in Android Studio (e.g. Pixel_7_API_36).
2. Terminal 1: `cd mobile-app` → `npx expo start --localhost -c --port 8081`  
   If the port is busy, note the port Expo picks (e.g. **8085**).
3. Terminal 2: `cd mobile-app` →  
   `powershell -File ./scripts/open-android.ps1 -Port 8085`  
   (use the **same port** as Metro)

Ensure `mobile-app/.env` has `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000` and the **backend** is running (`cd backend` → `npm start`).

### If you specifically want a QR in the terminal (recommended for phones)

Use the tunnel mode (it prints a QR you can scan from your PC screen):

```bash
cd mobile-app
npm run start:tunnel
```

If the QR still doesn’t show, run:

```bash
cd mobile-app
npx expo start --tunnel
```

Notes:
- Tunnel mode uses `@expo/ngrok` (already added to this project as a dev dependency).
- Make sure you run the command in your own terminal (interactive). Expo prints the QR in the terminal output.

## Features implemented

- **Chatbot**: floating assistant (same `/api/chatbot/message` API as the website) — tap 💬 on any screen
- Auth: login/register, secure token storage (`expo-secure-store`), auto refresh (`/auth/refresh`), logout
- User: dashboard (slot-based status + forecast), booking (slot + date/time/duration), QR screen, booking history
- Gatekeeper: QR scanner (`/gate/qr/preview`), check-in/check-out
- Admin: stats (`/admin/analytics`) and logs (`/admin/logs`)

## Notes

- QR codes are displayed from the backend-signed token (`reservation.qrJwt`). The app **does not generate QR data**.
- If you want Forecast to show data, start the Flask service too (your web README covers it). The mobile app calls `GET /api/forecast` on Express.

