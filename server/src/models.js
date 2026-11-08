import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (r, extra = {}) => ({ type: Schema.Types.ObjectId, ref: r, ...extra });
const T = { timestamps: true };
export const ROLES = ['owner', 'manager', 'cashier', 'kitchen', 'waiter'];

export const Restaurant = model('Restaurant', new Schema({
  name: String, currency: { type: String, default: 'PKR' }, taxRate: { type: Number, default: 16 },
  receiptFooter: { type: String, default: 'Thank you for dining with us' }, orderCounter: { type: Number, default: 1000 },
  prepTargetMinutes: { type: Number, default: 15 }, address: String, phone: String, receiptHeader: String,
  paymentMethods: { type: [String], default: ['cash', 'card', 'other'] }, notifyLowStock: { type: Boolean, default: true }, notifyOrderReady: { type: Boolean, default: true },
}, T));
export const User = model('User', new Schema({
  restaurant: ref('Restaurant', { index: true }), branch: ref('Branch'), name: String, email: { type: String, unique: true, lowercase: true },
  passwordHash: String, role: { type: String, enum: ROLES }, active: { type: Boolean, default: true },
}, T));
export const MenuCategory = model('MenuCategory', new Schema({ restaurant: ref('Restaurant', { index: true }), name: String, sort: { type: Number, default: 0 } }, T));
export const InventoryItem = model('InventoryItem', new Schema({
  restaurant: ref('Restaurant', { index: true }), name: String, unit: String, quantity: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 }, costPerUnit: { type: Number, default: 0 }, supplier: String,
}, T));
export const MenuItem = model('MenuItem', new Schema({
  restaurant: ref('Restaurant', { index: true }), category: ref('MenuCategory'), name: String, description: String,
  price: { type: Number, min: 0 }, image: String, available: { type: Boolean, default: true }, active: { type: Boolean, default: true },
  station: { type: String, default: 'kitchen' }, modifierGroups: [{ name: String, required: Boolean, options: [{ name: String, price: { type: Number, default: 0 } }] }], recipe: [{ ingredient: ref('InventoryItem'), qty: Number }],
}, T));
export const Table = model('Table', new Schema({
  restaurant: ref('Restaurant', { index: true }), branch: ref('Branch'), number: Number, seats: { type: Number, default: 4 }, combinedWith: [ref('Table')],
  status: { type: String, enum: ['available', 'occupied', 'reserved', 'bill_requested'], default: 'available' },
}, T));
export const Customer = model('Customer', new Schema({ restaurant: ref('Restaurant', { index: true }), name: String, phone: String, email: String, points: { type: Number, default: 0 } }, T));
const orderSchema = new Schema({
  restaurant: ref('Restaurant'), branch: ref('Branch'), number: Number, type: { type: String, enum: ['dine-in', 'takeaway', 'delivery'] },
  table: ref('Table'), customer: ref('Customer'), createdBy: ref('User'), notes: String,
  items: [{ menuItem: ref('MenuItem'), name: String, price: Number, qty: Number, notes: String, station: String, modifiers: [{ name: String, price: Number }] }],
  subtotal: Number, discount: Number, discountType: String, tax: Number, total: Number,
  status: { type: String, default: 'confirmed' }, paymentStatus: { type: String, enum: ['unpaid', 'paid', 'partially_refunded', 'refunded'], default: 'unpaid' },
  payments: [{ method: String, amount: Number, received: Number, change: Number, by: ref('User'), at: { type: Date, default: Date.now } }],
  refunds: [{ amount: Number, reason: String, by: ref('User'), at: { type: Date, default: Date.now } }],
  history: [{ status: String, by: ref('User'), at: { type: Date, default: Date.now } }],
  idempotencyKey: String, stockDeducted: { type: Boolean, default: false },
}, T);
orderSchema.index({ restaurant: 1, idempotencyKey: 1 }, {
  unique: true,
  
  partialFilterExpression: { idempotencyKey: { $type: 'string' } },
});
orderSchema.index({ restaurant: 1, createdAt: -1 });
export const Order = model('Order', orderSchema);
export const StockMovement = model('StockMovement', new Schema({
  restaurant: ref('Restaurant', { index: true }), item: ref('InventoryItem'), type: { type: String, enum: ['receive', 'adjust', 'usage'] },
  qty: Number, reason: String, order: ref('Order'), by: ref('User'),
}, T));
export const AuditLog = model('AuditLog', new Schema({ restaurant: ref('Restaurant', { index: true }), user: ref('User'), action: String, entity: String, entityId: String, meta: Object }, T));

export const Branch = model('Branch', new Schema({ restaurant: ref('Restaurant', { index: true }), name: String, address: String }, T));
export const Payment = model('Payment', new Schema({ restaurant: ref('Restaurant', { index: true }), order: ref('Order', { index: true }), method: String, amount: Number, received: Number, change: Number, by: ref('User') }, T));
export const Refund = model('Refund', new Schema({ restaurant: ref('Restaurant', { index: true }), order: ref('Order', { index: true }), amount: Number, reason: String, by: ref('User') }, T));
export const Notification = model('Notification', new Schema({ restaurant: ref('Restaurant', { index: true }), title: String, body: String, kind: String, read: { type: Boolean, default: false } }, T));
