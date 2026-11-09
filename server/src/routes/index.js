import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { auth, allow, httpError } from '../middleware/auth.js';
import * as os from '../services/orderService.js';
import { summary, fullReport, toCsv } from '../services/reportService.js';
import { User, Restaurant, MenuItem, MenuCategory, Table, Order, Customer, InventoryItem, StockMovement, AuditLog, Notification, Branch } from '../models.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const r = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const MGR = ['owner', 'manager'];
const clean = (b) => JSON.parse(JSON.stringify(b, (k, v) => (k.startsWith('$') ? undefined : v))); // blocks NoSQL operator injection

// ---- Auth
const cookieOpts = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.COOKIE_SAMESITE || 'lax', maxAge: 12 * 3600 * 1000 });
r.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const u = await User.findOne({ email: String(email).toLowerCase() });
  if (!u || !u.active || !(await bcrypt.compare(password, u.passwordHash))) throw httpError(401, 'Invalid email or password');
  res.cookie('token', jwt.sign({ id: u._id, restaurant: u.restaurant, role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' }), cookieOpts());
  res.json({ ok: true });
}));
r.post('/auth/logout', (req, res) => { res.clearCookie('token', cookieOpts()); res.json({ ok: true }); });
r.get('/auth/me', auth, wrap(async (req, res) => {
  const restaurant = await Restaurant.findById(req.user.restaurant).lean();
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }, restaurant });
}));

r.use(auth);

// ---- Dashboard
r.get('/dashboard/summary', allow(...MGR), wrap(async (req, res) => {
  const days = { today: 0, '7d': 6, '30d': 29 }[req.query.range] ?? 0;
  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setHours(0, 0, 0, 0) - days * 864e5);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  res.json(await summary(req.user.restaurant, from, to));
}));

// ---- Menu
r.get('/menu', wrap(async (req, res) => {
  const q = { restaurant: req.user.restaurant, ...(req.query.all ? {} : { active: true }) };
  const [items, categories] = await Promise.all([MenuItem.find(q).populate('category', 'name').sort('name').lean(), MenuCategory.find({ restaurant: req.user.restaurant }).sort('sort').lean()]);
  res.json({ items, categories });
}));
r.post('/menu', allow(...MGR), wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(1), price: z.number().min(0), category: z.string(), description: z.string().optional(), station: z.string().optional(), image: z.string().optional() }).parse(req.body);
  res.status(201).json(await MenuItem.create({ ...b, restaurant: req.user.restaurant }));
}));
r.patch('/menu/:id', allow(...MGR), wrap(async (req, res) => {
  const b = z.object({ name: z.string(), price: z.number().min(0), description: z.string(), available: z.boolean(), station: z.string(), category: z.string(), modifierGroups: z.array(z.object({ name: z.string().min(1), required: z.boolean(), options: z.array(z.object({ name: z.string().min(1), price: z.number().min(0) })).min(1) })) }).partial().parse(req.body);
  res.json(await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, b, { new: true }));
}));
r.delete('/menu/:id', allow(...MGR), wrap(async (req, res) => { // archive, never delete (orders reference items)
  await MenuItem.updateOne({ _id: req.params.id, restaurant: req.user.restaurant }, { active: false }); res.json({ ok: true });
}));
r.post('/categories', allow(...MGR), wrap(async (req, res) => res.status(201).json(await MenuCategory.create({ name: z.string().min(1).parse(req.body.name), restaurant: req.user.restaurant }))));

// ---- Tables
r.get('/tables', wrap(async (req, res) => {
  const tables = await Table.find({ restaurant: req.user.restaurant }).sort('number').lean();
  const open = await Order.find({ restaurant: req.user.restaurant, table: { $ne: null }, status: { $nin: ['completed', 'cancelled'] } }).select('table number createdAt total status').lean();
  res.json(tables.map((t) => ({ ...t, order: open.find((o) => String(o.table) === String(t._id)) || null })));
}));
r.post('/tables', allow(...MGR), wrap(async (req, res) => {
  const b = z.object({ number: z.number().int().min(1), seats: z.number().int().min(1).max(30) }).parse(req.body);
  res.status(201).json(await Table.create({ ...b, restaurant: req.user.restaurant }));
}));
r.patch('/tables/:id', wrap(async (req, res) => {
  const status = z.enum(['available', 'occupied', 'reserved', 'bill_requested']).parse(req.body.status);
  res.json(await Table.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, { status }, { new: true }));
}));
r.post('/tables/:id/transfer', allow('owner', 'manager', 'cashier', 'waiter'), wrap(async (req, res) => {
  const { toTable } = z.object({ toTable: z.string() }).parse(req.body);
  const to = await Table.findOne({ _id: toTable, restaurant: req.user.restaurant, status: 'available' });
  if (!to) throw httpError(409, 'Target table must be available');
  await Order.updateMany({ table: req.params.id, restaurant: req.user.restaurant, status: { $nin: ['completed', 'cancelled'] } }, { table: to._id });
  await Table.updateOne({ _id: req.params.id }, { status: 'available' }); await Table.updateOne({ _id: to._id }, { status: 'occupied' });
  res.json({ ok: true });
}));

// ---- Orders
r.get('/orders', wrap(async (req, res) => {
  const { status, type, paymentStatus, q, from, to } = clean(req.query);
  const page = Math.max(1, +req.query.page || 1), limit = Math.min(50, +req.query.limit || 15);
  const f = { restaurant: req.user.restaurant };
  if (status) f.status = String(status);
  if (type) f.type = String(type);
  if (paymentStatus) f.paymentStatus = String(paymentStatus);
  if (q) f.number = Number(q);
  if (from || to) f.createdAt = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
  const [data, total] = await Promise.all([Order.find(f).sort('-createdAt').skip((page - 1) * limit).limit(limit).populate('table', 'number').populate('createdBy', 'name').lean(), Order.countDocuments(f)]);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
}));
r.get('/orders/active', wrap(async (req, res) => { // kitchen state recovery after refresh/reconnect
  res.json(await Order.find({ restaurant: req.user.restaurant, $or: [{ status: { $in: ['confirmed', 'preparing', 'ready'] } }, { status: 'served', updatedAt: { $gte: new Date(Date.now() - 36e5) } }] }).populate('table', 'number').sort('createdAt').lean());
}));
r.post('/orders', allow('owner', 'manager', 'cashier', 'waiter'), wrap(async (req, res) => res.status(201).json(await os.createOrder(req.user, req.body))));
r.get('/orders/:id', wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.params.id, restaurant: req.user.restaurant }).populate('table', 'number').populate('createdBy', 'name').lean();
  if (!o) throw httpError(404, 'Not found'); res.json(o);
}));
r.patch('/orders/:id/status', wrap(async (req, res) => res.json(await os.setStatus(req.user, req.params.id, z.string().parse(req.body.status)))));
r.post('/orders/:id/cancel', allow(...MGR, 'cashier'), wrap(async (req, res) => res.json(await os.cancelOrder(req.user, req.params.id, req.body.reason))));
r.post('/orders/:id/payments', allow(...MGR, 'cashier', 'waiter'), wrap(async (req, res) => res.json(await os.addPayment(req.user, req.params.id, req.body))));
r.post('/orders/:id/refunds', wrap(async (req, res) => res.json(await os.refund(req.user, req.params.id, req.body))));

// ---- Inventory
r.get('/inventory', allow(...MGR), wrap(async (req, res) => res.json(await InventoryItem.find({ restaurant: req.user.restaurant }).sort('name').lean())));
r.post('/inventory', allow(...MGR), wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(1), unit: z.string(), minStock: z.number().min(0), costPerUnit: z.number().min(0), supplier: z.string().optional() }).parse(req.body);
  res.status(201).json(await InventoryItem.create({ ...b, restaurant: req.user.restaurant }));
}));
r.post('/inventory/:id/stock-movements', allow(...MGR), wrap(async (req, res) => {
  const b = z.object({ type: z.enum(['receive', 'adjust']), qty: z.number(), reason: z.string().min(2) }).parse(req.body);
  if (b.type === 'receive' && b.qty <= 0) throw httpError(400, 'Received quantity must be positive');
  const item = await InventoryItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, { $inc: { quantity: b.qty } }, { new: true });
  if (!item) throw httpError(404, 'Not found');
  await StockMovement.create({ ...b, item: item._id, restaurant: req.user.restaurant, by: req.user._id });
  await AuditLog.create({ restaurant: req.user.restaurant, user: req.user._id, action: 'stock.' + b.type, entity: 'InventoryItem', entityId: item._id, meta: b });
  res.json(item);
}));
r.get('/inventory/:id/movements', allow(...MGR), wrap(async (req, res) => res.json(await StockMovement.find({ item: req.params.id, restaurant: req.user.restaurant }).sort('-createdAt').limit(50).lean())));

// ---- Customers & staff
r.get('/customers', wrap(async (req, res) => res.json(await Customer.find({ restaurant: req.user.restaurant }).sort('name').lean())));
r.post('/customers', allow(...MGR, 'cashier'), wrap(async (req, res) => res.status(201).json(await Customer.create({ ...z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().optional() }).parse(req.body), restaurant: req.user.restaurant }))));
r.get('/users', allow(...MGR), wrap(async (req, res) => res.json(await User.find({ restaurant: req.user.restaurant }).select('-passwordHash').lean())));
r.post('/users', allow('owner'), wrap(async (req, res) => {
  const b = z.object({ name: z.string(), email: z.string().email(), password: z.string().min(8), role: z.enum(['manager', 'cashier', 'kitchen', 'waiter']) }).parse(req.body);
  const u = await User.create({ name: b.name, email: b.email, role: b.role, restaurant: req.user.restaurant, branch: req.user.branch, passwordHash: await bcrypt.hash(b.password, 10) });
  res.status(201).json({ id: u._id });
}));
r.patch('/users/:id', allow('owner'), wrap(async (req, res) => {
  const b = z.object({ active: z.boolean(), role: z.enum(['manager', 'cashier', 'kitchen', 'waiter']) }).partial().parse(req.body);
  await User.updateOne({ _id: req.params.id, restaurant: req.user.restaurant, role: { $ne: 'owner' } }, b);
  await AuditLog.create({ restaurant: req.user.restaurant, user: req.user._id, action: 'user.updated', entity: 'User', entityId: req.params.id, meta: b });
  res.json({ ok: true });
}));
r.get('/users/:id/activity', allow(...MGR), wrap(async (req, res) => {
  const [logs, orders] = await Promise.all([AuditLog.find({ restaurant: req.user.restaurant, user: req.params.id }).sort('-createdAt').limit(30).lean(), Order.countDocuments({ restaurant: req.user.restaurant, createdBy: req.params.id })]);
  res.json({ logs, ordersCreated: orders });
}));
r.get('/customers/:id', wrap(async (req, res) => {
  const c = await Customer.findOne({ _id: req.params.id, restaurant: req.user.restaurant }).lean(); if (!c) throw httpError(404, 'Not found');
  const orders = await Order.find({ customer: c._id }).sort('-createdAt').limit(50).select('number total createdAt paymentStatus type').lean();
  res.json({ ...c, orders, totalSpent: orders.filter((o) => ['paid', 'partially_refunded'].includes(o.paymentStatus)).reduce((s, o) => s + o.total, 0) });
}));
r.patch('/customers/:id', allow(...MGR, 'cashier'), wrap(async (req, res) => res.json(await Customer.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, z.object({ name: z.string(), phone: z.string(), email: z.string() }).partial().parse(req.body), { new: true }))));

// ---- Settings, branches, notifications
r.patch('/settings', allow('owner'), wrap(async (req, res) => {
  const b = z.object({ name: z.string(), currency: z.string().length(3), taxRate: z.number().min(0).max(100), receiptFooter: z.string(), receiptHeader: z.string(), address: z.string(), phone: z.string(),
    orderCounter: z.number().int().min(0), prepTargetMinutes: z.number().int().min(1), paymentMethods: z.array(z.enum(['cash', 'card', 'other'])).min(1), notifyLowStock: z.boolean(), notifyOrderReady: z.boolean() }).partial().parse(req.body);
  res.json(await Restaurant.findByIdAndUpdate(req.user.restaurant, b, { new: true }));
}));
r.get('/branches', wrap(async (req, res) => res.json(await Branch.find({ restaurant: req.user.restaurant }).lean())));
r.get('/notifications', wrap(async (req, res) => res.json(await Notification.find({ restaurant: req.user.restaurant }).sort('-createdAt').limit(30).lean())));
r.post('/notifications/read-all', wrap(async (req, res) => { await Notification.updateMany({ restaurant: req.user.restaurant }, { read: true }); res.json({ ok: true }); }));

// ---- Table combining
r.post('/tables/:id/combine', allow(...MGR, 'cashier', 'waiter'), wrap(async (req, res) => {
  const { withTable } = z.object({ withTable: z.string() }).parse(req.body);
  const [a, b] = await Promise.all([Table.findOne({ _id: req.params.id, restaurant: req.user.restaurant }), Table.findOne({ _id: withTable, restaurant: req.user.restaurant, status: 'available' })]);
  if (!a || !b || a._id.equals(b._id)) throw httpError(409, 'Pick an available table to combine with');
  a.combinedWith.push(b._id); a.status = 'occupied'; await a.save(); b.status = 'occupied'; await b.save();
  res.json({ ok: true });
}));

// ---- Image upload (Cloudinary; type + size validated)
const EXT = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1 };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, !!EXT[f.mimetype]) });
const toCloud = (buf) => new Promise((resolve, reject) =>
  cloudinary.uploader.upload_stream({ folder: 'servora', resource_type: 'image' }, (e, r) => (e ? reject(e) : resolve(r))).end(buf));
r.post('/menu/:id/image', allow(...MGR), upload.single('image'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'Upload a JPG, PNG or WebP under 2MB');
  const up = await toCloud(req.file.buffer);
  res.json(await MenuItem.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, { image: up.secure_url }, { new: true }));
}));

// ---- Reports
const range = (q) => { const days = { today: 0, '7d': 6, '30d': 29 }[q.range] ?? 6; return [q.from ? new Date(q.from) : new Date(new Date().setHours(0, 0, 0, 0) - days * 864e5), q.to ? new Date(q.to) : new Date()]; };
r.get('/reports/summary', allow(...MGR), wrap(async (req, res) => res.json(await fullReport(req.user.restaurant, ...range(req.query)))));
r.get('/reports/export', allow(...MGR), wrap(async (req, res) => {
  const d = await fullReport(req.user.restaurant, ...range(req.query));
  const rows = { sales: d.sales, items: d.items, payments: d.payments, categories: d.categories, ingredients: d.ingredientUsage }[req.query.report];
  if (!rows) throw httpError(400, 'Unknown report');
  res.type('text/csv').attachment(`${req.query.report}.csv`).send(toCsv(rows));
}));
export default r;
