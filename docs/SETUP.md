# SERVORA — Complete Setup Guide

## 1. Prerequisites
| Tool | Version | Check |
|---|---|---|
| Node.js | 18+ (20 LTS recommended) | `node -v` |
| npm | 9+ | `npm -v` |
| MongoDB | local 6/7 **or** free MongoDB Atlas | `mongosh --version` (local) |
| Git (optional) | any | `git --version` |

## 2. Get a database
**Option A: MongoDB Atlas (easiest, no install)**
1. Create a free account at mongodb.com/atlas, then create a free M0 cluster.
2. *Database Access* -> add a user (username + password; avoid special characters or URL-encode them).
3. *Network Access* -> add your IP (or `0.0.0.0/0` for testing only).
4. *Connect -> Drivers* -> copy the string, e.g. `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/servora`. Make sure the database name `servora` is before the `?`.

**Option B: local MongoDB** — install MongoDB Community, start it, and use `mongodb://127.0.0.1:27017/servora`.

## 3. Install
```bash
unzip servora.zip && cd servora
npm run install:all
```

## 4. Configure environment
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env      # Windows: copy instead of cp
```
Edit `server/.env`:
| Variable | Meaning | Dev value |
|---|---|---|
| `PORT` | API port | `5000` |
| `MONGO_URI` | Mongo connection string | from step 2 |
| `JWT_SECRET` | signs login cookies; long and random | generate below |
| `CLIENT_URL` | browser origin allowed by CORS/sockets | `http://localhost:5173` |
| `NODE_ENV` | `development` / `production` | `development` |
| `COOKIE_SAMESITE` | `lax` same-site, `none` for split domains | `lax` |
| `ALLOW_SEED` | production only: allow `npm run seed` (wipes DB) | unset |

`client/.env`: `VITE_API_URL` stays **empty** in dev (Vite proxies `/api` and `/socket.io` to port 5000).

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 5. Seed demo data
```bash
npm run seed
```
Creates: 1 restaurant + branch, 5 staff, 10 tables, 6 categories, 21 dishes, 10 ingredients with recipes, 42 completed orders over 7 days, 3 live kitchen orders, 2 customers.
**Warning: seed deletes everything in the database.** Never run it against real data.

## 6. Run
```bash
npm run dev:server    # terminal 1 -> http://localhost:5000/api/health
npm run dev:client    # terminal 2 -> http://localhost:5173
```
Demo logins (password `Servora@123`): `owner@`, `manager@`, `cashier@`, `kitchen@`, `waiter@` + `servora.test`.

## 7. Verify the install
```bash
npm test                              # unit tests + integration tests
npm --prefix server run lint
npm --prefix client run lint
npm run build                         # produces client/dist
```
`npm test` integration tests download an in-memory MongoDB the first time (needs internet).

## 8. Troubleshooting
| Symptom | Fix |
|---|---|
| `Set MONGO_URI and JWT_SECRET in .env` | `.env` missing or in the wrong folder (`server/.env`) |
| `ECONNREFUSED` / `MongooseServerSelectionError` | Mongo not running, wrong URI, or Atlas IP not allowed |
| Login works but next page says "Session expired" | Cookie blocked. Use `http://localhost:5173` (not a LAN IP) in dev, and keep `VITE_API_URL` empty |
| Kitchen doesn't update live | API not running or `CLIENT_URL` wrong; check the browser console for socket errors |
| `Cannot find module` | run `npm run install:all` again |
| Port in use | change `PORT` and the proxy target in `client/vite.config.js` |
| Fonts look plain | Google Fonts blocked offline; the UI falls back to system fonts |
