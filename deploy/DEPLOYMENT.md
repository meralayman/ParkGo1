# ParkGo production deployment

This project uses **Create React App** (not Vite). Use `REACT_APP_*` environment variables.

## Architecture

| Component | Port (default) | Notes |
|-----------|----------------|--------|
| React build | Nginx `:443` | `/var/www/parkgo/build` |
| Express API | `5000` | Proxied by Nginx on same domain |
| PostgreSQL | `5432` | `DATABASE_URL` in `backend/.env` |
| Flask demand (optional) | `5001` | Forecast ML |

Production API URL: set **`REACT_APP_API_BASE_URL=https://your-domain.com`** (no `/api` suffix). The app calls `/auth/login`, `/api/chat/history`, `/reservations`, etc. on that host.

---

## 1. Build the frontend (on dev machine or CI)

```bash
cd ParkGo
cp .env.production.example .env.production.local
# Edit REACT_APP_API_BASE_URL=https://your-domain.com

npm install
npm run build
```

Upload the `build/` folder to the server:

```bash
scp -r build/* user@your-server:/var/www/parkgo/build/
```

---

## 2. Backend on the server

```bash
cd /var/www/parkgo/backend
cp .env.example .env
# Set DATABASE_URL, JWT_ACCESS_SECRET, CORS_ORIGIN, PORT=5000, NODE_ENV=production, TRUST_PROXY=1

npm install --production
node server.js
# Or with PM2:
pm2 start server.js --name parkgo-api
pm2 save
```

`backend/.env` production example:

```env
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
TRUST_PROXY=1
DATABASE_URL=postgresql://parkgo_user:PASSWORD@127.0.0.1:5432/parkgo_db
JWT_ACCESS_SECRET=your-long-random-secret
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
```

Restart backend after deploy. On first start it creates `chat_messages` and aligns reservation status constraints.

---

## 3. Install Nginx (HTTP first)

```bash
sudo apt update
sudo apt install nginx
```

Use **HTTP-only** config until certificates exist (SSL paths in `parkgo.conf` will break Nginx if certs are missing):

```bash
sudo cp deploy/nginx/parkgo-http-only.conf /etc/nginx/sites-available/parkgo.conf
sudo nano /etc/nginx/sites-available/parkgo.conf
# Replace your-domain.com

sudo ln -sf /etc/nginx/sites-available/parkgo.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Confirm **http://your-domain.com** works, then enable HTTPS.

**Full guide:** [ENABLE-HTTPS.md](./ENABLE-HTTPS.md)

---

## 4. HTTPS with Let's Encrypt (required for padlock / https://)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
sudo certbot renew --dry-run
```

Then rebuild the frontend with `REACT_APP_API_BASE_URL=https://your-domain.com` and set `CORS_ORIGIN=https://your-domain.com` in `backend/.env`.

---

## 5. Verify

- `https://your-domain.com` — SPA loads, refresh on `/user` does not 404
- `https://your-domain.com/health` — `{"ok":true,...}`
- Log in, create booking, open chat — history persists after refresh
- Cancel booking from dashboard or chat — status `cancelled` in DB

---

## 6. Local development

**Terminal 1 — backend:**

```bash
cd backend
npm install
npm start
```

**Terminal 2 — frontend:**

```bash
npm install
# Optional .env: REACT_APP_API_BASE_URL=http://127.0.0.1:5000
npm start
```

**Mobile (Expo):** see `mobile-app/README.md`.

---

## Frontend API layer

All web API calls should go through `src/api/`:

- `authApi.js` — login, signup, logout, profile
- `bookingApi.js` — reservations, cancel
- `chatApi.js` — persistent chat
- `slotApi.js` — parking slots
- `adminApi.js` — admin dashboard
- `paymentApi.js` — Paymob session

`src/api/client.js` handles JSON parsing, friendly errors, and redirects to `/login` when the session expires.
