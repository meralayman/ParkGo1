# Enable HTTPS for ParkGo

HTTPS is **not automatic** — you must install SSL certificates on your server. The repo includes Nginx configs; **Certbot (Let's Encrypt)** adds HTTPS for free.

## Why the site might be HTTP only

1. **`parkgo.conf` with SSL paths** — Nginx will **fail to start** if certificate files do not exist yet. Use **`parkgo-http-only.conf` first**, then Certbot.
2. **Frontend built with `http://` API URL** — If the page is HTTPS but `REACT_APP_API_BASE_URL=http://...`, the browser blocks API calls. Fix: rebuild with HTTPS URL or leave `REACT_APP_API_BASE_URL` **empty** (the app uses the same origin as the page).

---

## Step 1 — HTTP must work first

On your Linux server:

```bash
sudo cp deploy/nginx/parkgo-http-only.conf /etc/nginx/sites-available/parkgo.conf
sudo nano /etc/nginx/sites-available/parkgo.conf
# Replace your-domain.com and /var/www/parkgo/build path

sudo ln -sf /etc/nginx/sites-available/parkgo.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Open `http://your-domain.com` — the site and login should work.

Backend `backend/.env`:

```env
NODE_ENV=production
TRUST_PROXY=1
CORS_ORIGIN=http://your-domain.com
```

After HTTPS, change `CORS_ORIGIN` to `https://your-domain.com`.

---

## Step 2 — Install Certbot and get HTTPS

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Domain must point to this server's public IP (DNS A record)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot will:

- Create `/etc/letsencrypt/live/your-domain.com/fullchain.pem`
- Update Nginx for port 443
- Redirect HTTP → HTTPS

Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## Step 3 — Rebuild frontend for HTTPS

On your PC (or CI):

```bash
# Option A — explicit HTTPS (recommended after Certbot)
echo REACT_APP_API_BASE_URL=https://your-domain.com > .env.production.local

# Option B — leave empty; production build uses window.location.origin (https:// after Certbot)
# (delete or comment out REACT_APP_API_BASE_URL)

npm run build
```

Upload `build/` to the server again.

Update backend:

```env
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
```

Restart API:

```bash
pm2 restart parkgo-api
```

---

## Step 4 — Use full SSL Nginx config (optional)

After Certbot, you can switch to the full template:

```bash
sudo cp deploy/nginx/parkgo.conf /etc/nginx/sites-available/parkgo.conf
# Edit ssl_certificate paths if Certbot used different names
sudo nginx -t && sudo systemctl reload nginx
```

---

## Local development (Windows) — HTTP is normal

`npm start` uses **http://localhost:3000** — that is expected. HTTPS on localhost is optional (mkcert / reverse proxy) and not required for development.

| Environment | URL |
|-------------|-----|
| Local dev | http://localhost:3000 |
| Production | https://your-domain.com (after Certbot) |

---

## Checklist

- [ ] DNS A record → server IP
- [ ] Nginx `parkgo-http-only.conf` works on port 80
- [ ] Backend running on port 5000 (`pm2` or `node server.js`)
- [ ] `certbot --nginx` completed without errors
- [ ] `https://your-domain.com` opens with padlock
- [ ] `https://your-domain.com/health` returns JSON
- [ ] Frontend rebuilt; login and chat work over HTTPS
