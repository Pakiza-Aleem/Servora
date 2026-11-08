# SERVORA — Deployment Guide

## Before you deploy (checklist)
- [ ] Strong, unique `JWT_SECRET` (48+ random bytes). Never commit `.env`.
- [ ] MongoDB Atlas cluster with a dedicated DB user; restrict network access where possible; enable backups.
- [ ] HTTPS only (cookies are `Secure` in production).
- [ ] **Do not use the demo accounts** with real data. Create a real owner with `create-owner` (below).
- [ ] Decide where uploaded dish photos live (see "Uploads" below).

## Create your first real owner (no demo data)
```bash
MONGO_URI="<atlas-uri>" npm run create-owner -- "My Restaurant" you@email.com "a-strong-password"
```
Then log in, open **Settings** (currency, tax, receipts, tables), **Menu** and **Inventory**, and add staff in **Team**.
To load the demo data on a *demo* deployment instead: `MONGO_URI="<atlas-uri>" JWT_SECRET=x npm run seed` from your own machine (this wipes the DB).

## Option A: single service on Render (recommended)
The Express server also serves the built React app, so cookies and WebSockets are same-origin and no CORS setup is needed.
1. Push the project to GitHub.
2. Render -> **New -> Web Service** -> pick the repo. Runtime: Node. Root directory: repo root.
3. **Build command** (important: the `--include=dev` is needed because Render sets `NODE_ENV=production`, which would otherwise skip Vite):
   ```
   npm --prefix server install && npm --prefix client install --include=dev && npm run build
   ```
4. **Start command:** `npm start`
5. **Environment variables:**
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | Atlas string |
   | `JWT_SECRET` | long random string |
   | `CLIENT_URL` | `https://<your-service>.onrender.com` (your final public URL) |
6. Health check path: `/api/health`.
7. In Atlas *Network Access*, allow Render's outbound IPs (simplest: `0.0.0.0/0` with a strong DB password).
8. Create the owner (see above), open your URL, log in.
Railway, Fly.io and similar hosts work the same way (same build/start commands).

## Option B: split hosting (client on Vercel/Netlify, API on Render)
**API (Render):** build `npm --prefix server install`, start `npm --prefix server start`. Env: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=https://your-client.app`, `COOKIE_SAMESITE=none`.
**Client (Vercel/Netlify):** root `client`, build `npm install --include=dev && npm run build`, output `dist`. Env at build time: `VITE_API_URL=https://your-api.onrender.com`.
Add an SPA rewrite: Netlify `_redirects` -> `/* /index.html 200`; Vercel `vercel.json` -> `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`.
Cross-site cookies need HTTPS on both sides, and some browsers block third-party cookies; if login loops, use Option A or put both under one parent domain.

## Option C: VPS (Ubuntu) with PM2 + Nginx
```bash
# Node 20, git, nginx installed. Clone project to /var/www/servora
cd /var/www/servora
npm --prefix server install && npm --prefix client install --include=dev && npm run build
cp server/.env.example server/.env   # set NODE_ENV=production, MONGO_URI, JWT_SECRET, CLIENT_URL=https://yourdomain.com
sudo npm i -g pm2 && pm2 start server/src/server.js --name servora && pm2 save && pm2 startup
```
Nginx site (then `sudo certbot --nginx -d yourdomain.com` for HTTPS):
```nginx
server {
  server_name yourdomain.com;
  client_max_body_size 3m;
  location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
Updating: `git pull && npm --prefix client run build && pm2 restart servora`.

## Uploads (dish photos)
Images are saved to `server/uploads/` on the server's disk. On Render's free tier the disk is **ephemeral**: photos disappear on redeploy/restart. Options: attach a Render persistent disk mounted at `server/uploads` (paid), use a VPS (disk persists), or move uploads to S3/Cloudinary (not built in).

## After deploying: smoke test
1. `https://your-url/api/health` returns `{"ok":true}`.
2. Log in as owner; Settings saves.
3. Add a dish and a table; place an order in POS; confirm it appears live in a second browser on Kitchen.
4. Refresh the page on `/orders` (SPA routing must not 404).
5. Check the browser console and the host logs for errors.

## Common deploy problems
| Symptom | Cause / fix |
|---|---|
| Build fails: `vite: not found` | devDependencies skipped. Use the build command above with `--include=dev` |
| Login succeeds then immediately logged out | Cookie not stored: not HTTPS, or split domains without `COOKIE_SAMESITE=none` |
| CORS error | `CLIENT_URL` must exactly match the browser origin (scheme + host, no trailing slash) |
| Kitchen not live | WebSocket upgrade blocked (Nginx headers above) or wrong `CLIENT_URL` |
| 404 on page refresh | Missing SPA rewrite (Option B) |
| Can't connect to Mongo | Atlas network access / wrong password / special characters in password not URL-encoded |
| Render app is slow on first hit | Free tier sleeps after inactivity |
| Seed refuses to run | Intentional in production; needs `ALLOW_SEED=true` and it wipes the DB |
