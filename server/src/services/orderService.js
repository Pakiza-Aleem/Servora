import { z } from 'zod';
import { Order, MenuItem, Restaurant, Table, InventoryItem, StockMovement, AuditLog, Payment, Refund, Notification, Customer } from '../models.js';
import { calcTotals, round2 } from '../utils/calc.js';
import { canTransition, KITCHEN_ALLOWED } from '../utils/stateMachine.js';
import { httpError } from '../middleware/auth.js';
import { emit } from '../sockets/index.js';

const createSchema = z.object({
  type: z.enum(['dine-in', 'takeaway', 'delivery']), table: z.string().optional(), customer: z.string().optional(),
  items: z.array(z.object({ menuItem: z.string(), qty: z.number().int().min(1).max(99), notes: z.string().max(200).optional(), modifiers: z.array(z.string()).optional() })).min(1),
  discountType: z.enum(['none', 'percent', 'fixed']).default('none'), discountValue: z.number().min(0).default(0),
  notes: z.string().max(500).optional(), idempotencyKey: z.string().min(8).max(80),
});
const audit = (user, action, entityId, meta) => AuditLog.create({ restaurant: user.restaurant, user: user._id, action, entity: 'Order', entityId, meta });
const broadcast = (o) => emit(o.restaurant, 'order:update', o);
export async function notify(restaurant, title, body, kind) {
  const r = await Restaurant.findById(restaurant).select('notifyLowStock notifyOrderReady').lean();
  if ((kind === 'lowStock' && !r?.notifyLowStock) || (kind === 'orderReady' && !r?.notifyOrderReady)) return;
  emit(restaurant, 'notification', await Notification.create({ restaurant, title, body, kind }));
}

// INVENTORY POLICY: stock is deducted once, when an order is created (confirmed).
// The atomic stockDeducted flag flip makes retries safe (no double deduction).
async function deductStock(order) {
  const claimed = await Order.findOneAndUpdate({ _id: order._id, stockDeducted: false }, { stockDeducted: true });
  if (!claimed) return;
  const menu = await MenuItem.find({ _id: { $in: order.items.map((i) => i.menuItem) } }).lean();
  for (const line of order.items) {
    const m = menu.find((x) => String(x._id) === String(line.menuItem));
    for (const r of m?.recipe || []) {
      const qty = r.qty * line.qty;
      const inv = await InventoryItem.findOneAndUpdate({ _id: r.ingredient }, { $inc: { quantity: -qty } }, { new: true });
      if (inv && inv.quantity <= inv.minStock) await notify(order.restaurant, 'Low stock', `${inv.name}: ${+inv.quantity.toFixed(2)} ${inv.unit} left`, 'lowStock');
      await StockMovement.create({ restaurant: order.restaurant, item: r.ingredient, type: 'usage', qty: -qty, order: order._id, reason: `Order #${order.number}` });
    }
  }
}

export async function createOrder(user, body) {
  const d = createSchema.parse(body);
  const existing = await Order.findOne({ restaurant: user.restaurant, idempotencyKey: d.idempotencyKey });
  if (existing) return existing; // duplicate submit -> same order
  if (d.discountType !== 'none' && !['owner', 'manager'].includes(user.role)) throw httpError(403, 'Only managers can apply discounts');
  if (d.type === 'dine-in') {
    const t = d.table && (await Table.findOne({ _id: d.table, restaurant: user.restaurant }));
    if (!t) throw httpError(400, 'Dine-in orders need a valid table');
  }
  const menu = await MenuItem.find({ _id: { $in: d.items.map((i) => i.menuItem) }, restaurant: user.restaurant, active: true, available: true }).lean();
  const lines = d.items.map((i) => {
    const m = menu.find((x) => String(x._id) === i.menuItem);
    if (!m) throw httpError(400, 'An item is unavailable or does not exist');
    const mods = [];
    for (const name of i.modifiers || []) {
      const opt = (m.modifierGroups || []).flatMap((g) => g.options).find((o) => o.name === name);
      if (!opt) throw httpError(400, 'Invalid modifier');
      mods.push({ name: opt.name, price: opt.price });
    }
    for (const g of m.modifierGroups || []) if (g.required && !g.options.some((o) => mods.some((x) => x.name === o.name))) throw httpError(400, `${g.name} is required for ${m.name}`);
    return { menuItem: m._id, name: m.name, price: m.price + mods.reduce((s, x) => s + x.price, 0), modifiers: mods, qty: i.qty, notes: i.notes, station: m.station };
  });
  const rest = await Restaurant.findOneAndUpdate({ _id: user.restaurant }, { $inc: { orderCounter: 1 } }, { new: true });
  const totals = calcTotals(lines, { discountType: d.discountType, discountValue: d.discountValue, taxRate: rest.taxRate });
  let order;
  try {
    order = await Order.create({
      restaurant: user.restaurant, branch: user.branch, number: rest.orderCounter, type: d.type, table: d.type === 'dine-in' ? d.table : undefined,
      customer: d.customer, createdBy: user._id, notes: d.notes, items: lines, ...totals, discountType: d.discountType,
      idempotencyKey: d.idempotencyKey, status: 'confirmed', history: [{ status: 'confirmed', by: user._id }],
    });
  } catch (e) {
    if (e.code === 11000) return Order.findOne({ restaurant: user.restaurant, idempotencyKey: d.idempotencyKey });
    throw e;
  }
  if (order.table) await Table.updateOne({ _id: order.table }, { status: 'occupied' });
  await deductStock(order);
  if (totals.discount > 0) await audit(user, 'discount.applied', order._id, { discount: totals.discount });
  broadcast(order);
  return order;
}

const load = async (user, id) => {
  const o = await Order.findOne({ _id: id, restaurant: user.restaurant });
  if (!o) throw httpError(404, 'Order not found');
  return o;
};
async function releaseTable(order) {
  if (!order.table) return;
  const open = await Order.countDocuments({ table: order.table, _id: { $ne: order._id }, status: { $nin: ['completed', 'cancelled'] } });
  if (!open) {
    const t = await Table.findByIdAndUpdate(order.table, { status: 'available', combinedWith: [] });
    if (t?.combinedWith?.length) await Table.updateMany({ _id: { $in: t.combinedWith } }, { status: 'available' });
  }
}

export async function setStatus(user, id, status) {
  const o = await load(user, id);
  if (user.role === 'kitchen' && !KITCHEN_ALLOWED.includes(status)) throw httpError(403, 'Kitchen can only mark preparing/ready');
  if (!canTransition(o.status, status)) throw httpError(409, `Cannot move order from ${o.status} to ${status}`);
  if (status === 'completed' && o.paymentStatus === 'unpaid') throw httpError(409, 'Record payment before completing');
  o.status = status; o.history.push({ status, by: user._id }); await o.save();
  if (['completed', 'cancelled'].includes(status)) await releaseTable(o);
  if (status === 'ready') await notify(o.restaurant, 'Order ready', `Order #${o.number} is ready`, 'orderReady');
  broadcast(o); return o;
}

export async function cancelOrder(user, id, reason) {
  const o = await load(user, id);
  if (o.paymentStatus !== 'unpaid') throw httpError(409, 'Paid orders must be refunded, not cancelled');
  if (!reason) throw httpError(400, 'Reason required');
  const out = await setStatus(user, id, 'cancelled');
  if (o.stockDeducted) { // restore stock for the cancelled order (state machine guarantees this runs once)
    for (const m of await StockMovement.find({ order: o._id, type: 'usage' })) {
      await InventoryItem.updateOne({ _id: m.item }, { $inc: { quantity: -m.qty } });
      await StockMovement.create({ restaurant: o.restaurant, item: m.item, type: 'adjust', qty: -m.qty, order: o._id, by: user._id, reason: `Order #${o.number} cancelled` });
    }
  }
  await audit(user, 'order.cancelled', id, { reason }); return out;
}

export async function addPayment(user, id, { method, amount, received }) {
  const rest = await Restaurant.findById(user.restaurant).lean();
  if (!(rest.paymentMethods || []).includes(method)) throw httpError(400, 'Invalid payment method');
  const o = await load(user, id);
  if (o.status === 'cancelled') throw httpError(409, 'Order is cancelled');
  const paid = o.payments.reduce((s, p) => s + p.amount, 0);
  const due = round2(o.total - paid);
  if (due <= 0) throw httpError(409, 'Order already paid');
  amount = round2(amount ?? due);
  if (amount <= 0 || amount > due) throw httpError(400, `Amount must be between 0 and ${due}`);
  let change = 0;
  if (method === 'cash') { received = received ?? amount; if (received < amount) throw httpError(400, 'Cash received is less than amount'); change = round2(received - amount); }
  o.payments.push({ method, amount, received, change, by: user._id });
  await Payment.create({ restaurant: o.restaurant, order: o._id, method, amount, received, change, by: user._id });
  if (round2(paid + amount) >= o.total) { o.paymentStatus = 'paid'; if (o.customer) await Customer.updateOne({ _id: o.customer }, { $inc: { points: Math.floor(o.total / 100) } }); }
  await o.save(); broadcast(o); return o;
}

export async function refund(user, id, { amount, reason }) {
  if (!['owner', 'manager'].includes(user.role)) throw httpError(403, 'Only managers can refund');
  const o = await load(user, id);
  if (!reason) throw httpError(400, 'Reason required');
  const paid = o.payments.reduce((s, p) => s + p.amount, 0);
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  if (paid === 0) throw httpError(409, 'Nothing to refund');
  if (!(amount > 0) || round2(refunded + amount) > paid) throw httpError(400, 'Refund exceeds paid amount');
  await Refund.create({ restaurant: o.restaurant, order: o._id, amount, reason, by: user._id });
  o.refunds.push({ amount, reason, by: user._id }); // completed transactions are never overwritten
  o.paymentStatus = round2(refunded + amount) >= paid ? 'refunded' : 'partially_refunded';
  await o.save(); await audit(user, 'order.refunded', id, { amount, reason }); broadcast(o); return o;
}
