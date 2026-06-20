# ParkGo setup audit (your machine)

**Last checked:** Windows dev PC — project under `Downloads\Telegram Desktop\ParkGo (6)\ParkGo`

## Verdict: you are running **locally**, not on a VPS

| Signal | Your environment |
|--------|------------------|
| OS / path | Windows, local folder (not `/var/www/...`) |
| Frontend | `npm start` → **http://localhost:3000** (port open) |
| Backend | `cd backend && npm start` → **http://localhost:5000** (health OK) |
| Mobile | `npx expo start` in `mobile-app/` |
| Nginx | **Not installed** / not running |
| HTTPS :443 | **Not listening** |
| `build/` folder | **Missing** (no production static deploy) |
| SSL certs | **None** on this machine |
| Socket.io | **Not used** in this repo (chat uses REST `/api/chat/*`) |

Use **local rules** below. Ignore Certbot/Nginx until you deploy to a Linux server with a domain.

---

## Local development (what you should use now)

### URLs

| Service | URL |
|---------|-----|
| Website | http://localhost:3000 |
| API | http://127.0.0.1:5000 |
| Health check | http://127.0.0.1:5000/health |

### Do **not** force HTTPS locally

- CRA dev server is HTTP only unless you add custom certs (not needed).
- `REACT_APP_API_BASE_URL` in production builds does **not** apply to `npm start` unless you set `.env.development`.

### API configuration (already correct)

- `package.json` → `"proxy": "http://127.0.0.1:5000"`
- `src/config/apiOrigin.js` → defaults to `http://127.0.0.1:5000` in development
- Optional: `.env.development` → `REACT_APP_API_BASE_URL=http://127.0.0.1:5000`

### Run (two terminals)

```powershell
# Terminal 1
cd backend
npm start

# Terminal 2 (repo root)
npm start
```

Open **http://localhost:3000** (not https).

### Mobile (Expo)

See `mobile-app/README.md` — API via `mobile-app/.env` LAN IP or Android emulator `10.0.2.2`.

---

## VPS / domain (only when you deploy later)

When you move to a server, follow in order:

1. `deploy/nginx/parkgo-http-only.conf` → HTTP works
2. Upload `npm run build` output to `/var/www/parkgo/build`
3. Backend `PORT=5000`, `HOST=0.0.0.0`, `pm2 start server.js`
4. Nginx proxies **`/api`**, **`/auth`**, **`/reservations`**, **`/slots`**, **`/admin`**, etc. (not only `/api`)
5. `certbot --nginx` → HTTPS
6. Rebuild with `REACT_APP_API_BASE_URL=https://your-domain.com`
7. `CORS_ORIGIN=https://your-domain.com`, `TRUST_PROXY=1`
8. Restart PM2 + Nginx

Details: [ENABLE-HTTPS.md](./ENABLE-HTTPS.md), [DEPLOYMENT.md](./DEPLOYMENT.md)

### API path note for production

ParkGo does **not** put every route under `/api`. Examples:

- `https://your-domain.com/auth/login`
- `https://your-domain.com/api/chat/history`
- `https://your-domain.com/reservations/...`

Nginx must proxy all backend path prefixes (see `parkgo-http-only.conf`), not only `/api`.

---

## Checklist for **your current local setup**

- [x] Backend on port 5000
- [x] Frontend on port 3000
- [x] No HTTPS required locally
- [ ] Flask on 5001 optional (forecast warnings are OK without it)
- [ ] Login test at http://localhost:3000/login
- [ ] Chat requires logged-in user → `/api/chat/history`
