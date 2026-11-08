
import {
  Order,
  Table,
  InventoryItem,
  MenuItem,
  MenuCategory,
  StockMovement,
} from '../models.js';
import { round2 } from '../utils/calc.js';
import mongoose from 'mongoose';

export async function summary(restaurant, from, to) {
  const rid = new mongoose.Types.ObjectId(restaurant);

  const orders = await Order.find({
    restaurant: rid,
    createdAt: { $gte: from, $lte: to },
  }).lean();

  const paid = orders.filter((o) =>
    ['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus)
  );

  const refunds = round2(
    paid.reduce(
      (sum, o) =>
        sum +
        (Array.isArray(o.refunds)
          ? o.refunds.reduce((total, r) => total + (Number(r.amount) || 0), 0)
          : 0),
      0
    )
  );

  const gross = round2(
    paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
  );

  const tax = round2(
    paid.reduce((sum, o) => sum + (Number(o.tax) || 0), 0)
  );

  const netSales = round2(gross - refunds - tax);

  const byDay = {};
  const items = {};
  const status = {};
  const types = {};

  paid.forEach((o) => {
    const k = new Date(o.createdAt).toISOString().slice(0, 10);

    byDay[k] = round2((byDay[k] || 0) + (Number(o.total) || 0));

    const type = o.type || 'unknown';
    types[type] = round2((types[type] || 0) + (Number(o.total) || 0));

    (Array.isArray(o.items) ? o.items : []).forEach((i) => {
      const name = i.name || 'Unnamed item';
      items[name] = (items[name] || 0) + (Number(i.qty) || 0);
    });
  });

  orders.forEach((o) => {
    const orderStatus = o.status || 'unknown';
    status[orderStatus] = (status[orderStatus] || 0) + 1;
  });

  const tables = await Table.find({ restaurant: rid }).lean();
  const inv = await InventoryItem.find({ restaurant: rid }).lean();

  return {
    grossRevenue: gross,
    refunds,
    tax,
    netSales,
    orders: orders.length,
    paidOrders: paid.length,

    avgOrderValue: paid.length ? round2(gross / paid.length) : 0,

    sales: Object.entries(byDay)
      .sort()
      .map(([date, total]) => ({ date, total })),

    revenueByType: Object.entries(types).map(([type, total]) => ({
      type,
      total,
    })),

    topItems: Object.entries(items)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, qty]) => ({ name, qty })),

    statusSummary: status,

    occupancy: {
      occupied: tables.filter((t) => t.status !== 'available').length,
      total: tables.length,
    },

    lowStock: inv.filter(
      (i) => (Number(i.quantity) || 0) <= (Number(i.minStock) || 0)
    ),
  };
}

export async function fullReport(restaurant, from, to) {
  const rid = new mongoose.Types.ObjectId(restaurant);

  const orders = await Order.find({
    restaurant: rid,
    createdAt: { $gte: from, $lte: to },
    paymentStatus: {
      $in: ['paid', 'partially_refunded', 'refunded'],
    },
  }).lean();

  const [menu, cats, inv, usage] = await Promise.all([
    MenuItem.find({ restaurant: rid }).lean(),
    MenuCategory.find({ restaurant: rid }).lean(),
    InventoryItem.find({ restaurant: rid }).lean(),
    StockMovement.find({
      restaurant: rid,
      type: 'usage',
      createdAt: { $gte: from, $lte: to },
    }).lean(),
  ]);

  const invMap = Object.fromEntries(
    inv.map((i) => [String(i._id), i])
  );

  const costOf = (m) =>
    m?.recipe?.length &&
    m.recipe.every(
      (r) => (Number(invMap[String(r.ingredient)]?.costPerUnit) || 0) > 0
    )
      ? m.recipe.reduce(
          (sum, r) =>
            sum +
            (Number(r.qty) || 0) *
              (Number(invMap[String(r.ingredient)].costPerUnit) || 0),
          0
        )
      : null;

  const byDay = {};
  const byType = {};
  const pay = {};
  const catPerf = {};
  const items = {};

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
  }));

  let refunds = 0;
  let revenue = 0;
  let costable = 0;
  let cost = 0;

  const add = (obj, key, value) => {
    obj[key] = round2((obj[key] || 0) + (Number(value) || 0));
  };

  for (const o of orders) {
    const total = Number(o.total) || 0;
    const subtotal = Number(o.subtotal) || 0;
    const createdAt = new Date(o.createdAt);

    revenue += total;

    add(byDay, createdAt.toISOString().slice(0, 10), total);
    add(byType, o.type || 'unknown', total);

    hours[createdAt.getHours()].orders++;

    (Array.isArray(o.payments) ? o.payments : []).forEach((p) => {
      add(pay, p.method || 'unknown', p.amount);
    });

    (Array.isArray(o.refunds) ? o.refunds : []).forEach((r) => {
      refunds += Number(r.amount) || 0;
    });

    (Array.isArray(o.items) ? o.items : []).forEach((l) => {
      const m = menu.find((x) => String(x._id) === String(l.menuItem));

      const category =
        cats.find((c) => String(c._id) === String(m?.category))?.name ||
        'Other';

      const lineRevenue = (Number(l.price) || 0) * (Number(l.qty) || 0);

      add(catPerf, category, lineRevenue);

      const name = l.name || 'Unnamed item';

      items[name] = items[name] || { qty: 0, revenue: 0 };

      items[name].qty += Number(l.qty) || 0;
      items[name].revenue = round2(items[name].revenue + lineRevenue);

      const itemCost = costOf(m);

      if (itemCost != null) {
        costable += lineRevenue;
        cost += itemCost * (Number(l.qty) || 0);
      }
    });

    // Keep subtotal available for profit coverage calculations.
    void subtotal;
  }

  const use = {};

  usage.forEach((u) => {
    const i = invMap[String(u.item)];

    if (i) {
      use[i.name] = use[i.name] || {
        unit: i.unit,
        qty: 0,
      };

      use[i.name].qty = round2(
        use[i.name].qty - (Number(u.qty) || 0)
      );
    }
  });

  const arr = (obj, key) =>
    Object.entries(obj).map(([name, total]) => ({
      [key]: name,
      total,
    }));

  const subtotalTotal = orders.reduce(
    (sum, o) => sum + (Number(o.subtotal) || 0),
    0
  );

  return {
    orders: orders.length,
    revenue: round2(revenue),
    refunds: round2(refunds),

    avgOrderValue: orders.length
      ? round2(revenue / orders.length)
      : 0,

    sales: arr(byDay, 'date').sort((a, b) =>
      a.date.localeCompare(b.date)
    ),

    byType: arr(byType, 'type'),
    payments: arr(pay, 'method'),
    categories: arr(catPerf, 'category'),

    peakHours: hours.filter((h) => h.orders > 0),

    items: Object.entries(items)
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.qty - a.qty),

    ingredientUsage: Object.entries(use).map(([name, value]) => ({
      name,
      ...value,
    })),

    estGrossProfit: round2(costable - cost),

    profitCoverage: revenue
      ? round2(costable / Math.max(1, subtotalTotal))
      : 0,
  };
}

export const toCsv = (rows) => {
  if (!rows || rows.length === 0) {
    return '';
  }

  const headers = Object.keys(rows[0]).join(',');

  const lines = rows.map((row) =>
    Object.values(row)
      .map((value) => {
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',')
  );

  return [headers, ...lines].join('\n');
};