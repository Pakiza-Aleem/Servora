# SERVORA — Every order. Every table. One system.
**Guides:** [Setup](docs/SETUP.md) · [Testing all roles](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md)

Restaurant POS & management (MERN). Plain CSS with design tokens (no Tailwind, no inline styles).

## 1. Local setup
Requirements: Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
npm run install:all
cp server/.env.example server/.env      # then edit MONGO_URI and set a long random JWT_SECRET
cp client/.env.example client/.env      # leave VITE_API_URL empty in dev
npm run seed                            # demo restaurant, 21 menu items, tables, inventory, orders
npm run dev:server                      # terminal 1 -> http://localhost:5000
npm run dev:client                      # terminal 2 -> http://localhost:5173
```
Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### Demo accounts (development only) — password `Servora@123`
owner@ / manager@ / cashier@ / kitchen@ / waiter@ `servora.test`

Tests: `npm test` (totals, discounts, state machine).

## 2. Try the order lifecycle
1. Log in as cashier -> POS -> pick items, table, Charge (order is confirmed + paid, stock deducted, kitchen notified live).
2. Open Kitchen in another browser (kitchen@): Start -> Mark ready. A cashier/manager marks Served.
3. Orders -> Complete (table frees automatically). Manager: Refund with a reason.

## 3. Deployment

### Option A — one service (simplest): Render / Railway / any VPS
1. Create a free **MongoDB Atlas** cluster, a DB user, and allow network access (0.0.0.0/0 or your host's IPs). Copy the connection string.
2. Push this repo to GitHub.
3. On **Render** create a *Web Service* from the repo:
   - Build command: `npm --prefix server install && npm --prefix client install --include=dev && npm run build`
   - Start command: `npm start`
   - Env vars: `MONGO_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_URL=https://<your-service>.onrender.com`
4. Seed once from your machine with the Atlas URI: `MONGO_URI="<atlas-uri>" JWT_SECRET=x npm run seed` (or in the Render shell: `npm run seed`). **Change/remove demo accounts afterwards.**
The Express server serves the built React app, so cookies and Socket.IO are same-origin; no CORS setup needed.

### Option B — split hosting (client on Vercel/Netlify, API on Render)
- API env: `CLIENT_URL=https://your-client.app`, `COOKIE_SAMESITE=none`, `NODE_ENV=production` (cookies become Secure; HTTPS required).
- Client env at build time: `VITE_API_URL=https://your-api.onrender.com`.
- Add an SPA rewrite on the client host (`/* -> /index.html`).

### VPS with PM2 + Nginx (outline)
`npm run install:all && npm run build`, run `pm2 start server/src/server.js --name servora`, and reverse-proxy Nginx to port 5000 with WebSocket upgrade headers and HTTPS (certbot).

## 4. Architecture notes
- Totals, tax and discounts are computed only on the server (`server/src/utils/calc.js`). Tax is exclusive, applied after discount.
- Duplicate checkout: each cart carries an idempotency key; a unique index returns the existing order on retry.
- Inventory policy: stock is deducted once when an order is created; an atomic flag prevents double deduction; every change is in the `StockMovement` ledger.
- Refunds are separate entries on the order (never overwrite payments), need a reason, are manager/owner only and audit-logged.
- Sockets authenticate via the httpOnly cookie; rooms are per restaurant. Kitchen reloads server state on connect.
- Theme: edit `client/src/styles/variables.css`.

## 5. API summary (all under /api, cookie auth)
Auth: POST auth/login, auth/logout, GET auth/me · GET dashboard/summary?range=today|7d|30d&from&to
Menu: GET/POST menu, PATCH/DELETE(archive) menu/:id, POST categories
Tables: GET/POST tables, PATCH tables/:id, POST tables/:id/transfer
Orders: GET orders (q,status,type,paymentStatus,from,to,page), GET orders/active, POST orders, GET orders/:id, PATCH orders/:id/status, POST orders/:id/cancel|payments|refunds
Inventory: GET/POST inventory, POST inventory/:id/stock-movements, GET inventory/:id/movements
Other: GET/POST customers, GET/POST users, PATCH users/:id, PATCH settings

## 6. Status vs. the original spec
Implemented: all 11 pages (Overview, POS, Tables, Kitchen, Menu, Inventory, Orders, Customers, Reports, Team, Settings) plus Login/404; modifiers/add-ons; image upload (JPG/PNG/WebP, 2MB); table combining and transfer; notifications (low stock, order ready) over Socket.IO; CSV export; separate `Payment`, `Refund`, `Branch`, `Notification` collections; stock restored on cancel; loyalty points; Redux Toolkit (cart, notifications) and React Hook Form; ESLint (`npm --prefix server run lint`, `npm --prefix client run lint`); integration tests (`npm test`, needs `mongodb-memory-server`).

Honest limitations: the integration tests and the client build were written without network access, so they have not been executed by me. Run `npm run build` and `npm test` first and report failures. Remaining gaps: the branch selector shows the single branch (no multi-branch switching UI), per-station kitchen filtering is a label only, Kitchen "Completed" column is represented by served orders for one hour, no automated responsive/visual testing, and demo item photos are letter placeholders (upload real images via Menu -> Edit).
