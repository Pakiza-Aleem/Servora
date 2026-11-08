// Needs mongodb-memory-server (downloads a MongoDB binary on first run).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
process.env.JWT_SECRET = 'test-secret';
const M = await import('../models.js');
const svc = await import('../services/orderService.js');
const { app } = await import('../app.js');
let mongod, server, base; const u = {}; let item, flour;
before(async () => {
  mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); await M.Order.init();
  const rest = await M.Restaurant.create({ name: 'T', taxRate: 10 });
  flour = await M.InventoryItem.create({ restaurant: rest._id, name: 'Flour', unit: 'kg', quantity: 10, minStock: 1 });
  const cat = await M.MenuCategory.create({ restaurant: rest._id, name: 'Mains' });
  item = await M.MenuItem.create({ restaurant: rest._id, name: 'Pizza', price: 1000, category: cat._id, recipe: [{ ingredient: flour._id, qty: 0.5 }] });
  const hash = await bcrypt.hash('pw123456', 4);
  for (const role of ['owner', 'manager', 'cashier', 'kitchen']) u[role] = await M.User.create({ restaurant: rest._id, name: role, role, email: `${role}@t.io`, passwordHash: hash });
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server?.close(); await mongoose.disconnect(); await mongod?.stop(); });
const body = (key) => ({ type: 'takeaway', items: [{ menuItem: String(item._id), qty: 2 }], idempotencyKey: key });
test('duplicate checkout creates one order and deducts stock once; totals are server-side', async () => {
  const [a, b] = await Promise.all([svc.createOrder(u.cashier, body('dup-key-0001')), svc.createOrder(u.cashier, body('dup-key-0001'))]);
  assert.equal(String(a._id), String(b._id));
  assert.equal(a.total, 2200);
  assert.equal((await M.InventoryItem.findById(flour._id)).quantity, 9);
  assert.equal(await M.Order.countDocuments({ idempotencyKey: 'dup-key-0001' }), 1);
});
test('refund validation and permissions', async () => {
  const o = await svc.createOrder(u.cashier, body('refund-key-01'));
  await svc.addPayment(u.cashier, o._id, { method: 'cash', received: 3000 });
  await assert.rejects(svc.refund(u.cashier, o._id, { amount: 10, reason: 'x' }), { status: 403 });
  await assert.rejects(svc.refund(u.manager, o._id, { amount: 99999, reason: 'x' }), { status: 400 });
  const r = await svc.refund(u.manager, o._id, { amount: 200, reason: 'cold food' });
  assert.equal(r.paymentStatus, 'partially_refunded');
});
test('invalid state transition is rejected; cancel restores stock', async () => {
  const o = await svc.createOrder(u.cashier, body('state-key-001'));
  await assert.rejects(svc.setStatus(u.manager, o._id, 'completed'), { status: 409 });
  const before = (await M.InventoryItem.findById(flour._id)).quantity;
  await svc.cancelOrder(u.manager, o._id, 'test');
  assert.equal((await M.InventoryItem.findById(flour._id)).quantity, before + 1);
});
test('role-based access over HTTP', async () => {
  const login = async (email) => (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'pw123456' }) })).headers.get('set-cookie').split(';')[0];
  const get = (cookie) => fetch(`${base}/api/dashboard/summary`, { headers: { cookie } });
  assert.equal((await get(await login('cashier@t.io'))).status, 403);
  assert.equal((await get(await login('owner@t.io'))).status, 200);
});
