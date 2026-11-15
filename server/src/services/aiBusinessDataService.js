import mongoose from 'mongoose';
import {
  InventoryItem,
  MenuItem,
  Order,
  Restaurant,
  StockMovement,
} from '../models.js';
import { httpError } from '../middleware/auth.js';
import { round2 } from '../utils/calc.js';

const PAID_STATUSES = ['paid', 'partially_refunded', 'refunded'];
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const startOfWeek = (date) => {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

const refundsExpression = {
  $reduce: {
    input: { $ifNull: ['$refunds', []] },
    initialValue: 0,
    in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
  },
};

const salesMetric = (row = {}) => {
  const grossRevenue = round2(Number(row.grossRevenue) || 0);
  const refunds = round2(Number(row.refunds) || 0);
  const tax = round2(Number(row.tax) || 0);
  return {
    paidOrders: Number(row.paidOrders) || 0,
    grossRevenue,
    refunds,
    tax,
    netSales: round2(grossRevenue - refunds - tax),
  };
};

const sumSales = (rows) => {
  const totals = rows.reduce((sum, row) => ({
    paidOrders: sum.paidOrders + row.paidOrders,
    grossRevenue: sum.grossRevenue + row.grossRevenue,
    refunds: sum.refunds + row.refunds,
    tax: sum.tax + row.tax,
  }), { paidOrders: 0, grossRevenue: 0, refunds: 0, tax: 0 });
  return salesMetric(totals);
};

const percentChange = (current, previous) => (
  previous > 0 ? round2(((current - previous) / previous) * 100) : null
);

const dateKey = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

export async function buildBusinessSnapshot(restaurantId, now = new Date()) {
  const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const previousWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const elapsedThisWeek = now.getTime() - weekStart.getTime();
  const previousWeekSamePeriodEnd = new Date(previousWeekStart.getTime() + elapsedThisWeek);
  const thirtyDayStart = new Date(today.getTime() - 29 * DAY_MS);

  const restaurant = await Restaurant.findById(restaurantObjectId).select('currency').lean();
  if (!restaurant) throw httpError(404, 'Restaurant not found');

  const orderMatch = {
    restaurant: restaurantObjectId,
    paymentStatus: { $in: PAID_STATUSES },
  };

  const [weekly, daily, itemSales, hourly, inventory, usage, menuItems] = await Promise.all([
    Order.aggregate([
      { $match: { ...orderMatch, createdAt: { $gte: previousWeekStart, $lt: now } } },
      { $addFields: { refundTotal: refundsExpression } },
      {
        $facet: {
          thisWeekToDate: [
            { $match: { createdAt: { $gte: weekStart } } },
            { $group: { _id: null, paidOrders: { $sum: 1 }, grossRevenue: { $sum: '$total' }, refunds: { $sum: '$refundTotal' }, tax: { $sum: '$tax' } } },
          ],
          previousWeekSamePeriod: [
            { $match: { createdAt: { $lt: previousWeekSamePeriodEnd } } },
            { $group: { _id: null, paidOrders: { $sum: 1 }, grossRevenue: { $sum: '$total' }, refunds: { $sum: '$refundTotal' }, tax: { $sum: '$tax' } } },
          ],
          lastCompletedWeek: [
            { $match: { createdAt: { $lt: weekStart } } },
            { $group: { _id: null, paidOrders: { $sum: 1 }, grossRevenue: { $sum: '$total' }, refunds: { $sum: '$refundTotal' }, tax: { $sum: '$tax' } } },
          ],
        },
      },
    ]),
    Order.aggregate([
      { $match: { ...orderMatch, createdAt: { $gte: thirtyDayStart, $lt: now } } },
      { $addFields: { refundTotal: refundsExpression } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: timeZone } },
          paidOrders: { $sum: 1 },
          grossRevenue: { $sum: '$total' },
          refunds: { $sum: '$refundTotal' },
          tax: { $sum: '$tax' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { ...orderMatch, createdAt: { $gte: thirtyDayStart, $lt: now } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.menuItem', '$items.name'] },
          name: { $first: '$items.name' },
          unitsSold: { $sum: { $ifNull: ['$items.qty', 0] } },
          grossRevenue: { $sum: { $multiply: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.qty', 0] }] } },
        },
      },
      { $sort: { unitsSold: -1, name: 1 } },
      { $limit: 100 },
    ]),
    Order.aggregate([
      { $match: { ...orderMatch, createdAt: { $gte: thirtyDayStart, $lt: now } } },
      {
        $group: {
          _id: { $hour: { date: '$createdAt', timezone: timeZone } },
          paidOrders: { $sum: 1 },
        },
      },
      { $sort: { paidOrders: -1, _id: 1 } },
      { $limit: 3 },
    ]),
    InventoryItem.aggregate([
      { $match: { restaurant: restaurantObjectId } },
      {
        $facet: {
          lowStock: [
            { $match: { $expr: { $lte: [{ $ifNull: ['$quantity', 0] }, { $ifNull: ['$minStock', 0] }] } } },
            { $sort: { name: 1 } },
            { $limit: 50 },
            { $project: { _id: 0, name: 1, unit: 1, quantity: 1, minStock: 1 } },
          ],
          counts: [{ $count: 'total' }],
          lowStockCounts: [
            { $match: { $expr: { $lte: [{ $ifNull: ['$quantity', 0] }, { $ifNull: ['$minStock', 0] }] } } },
            { $count: 'total' },
          ],
        },
      },
    ]),
    StockMovement.aggregate([
      { $match: { restaurant: restaurantObjectId, type: 'usage', createdAt: { $gte: thirtyDayStart, $lt: now } } },
      { $group: { _id: '$item', quantityUsed: { $sum: { $abs: { $ifNull: ['$qty', 0] } } } } },
      { $sort: { quantityUsed: -1 } },
      { $limit: 10 },
    ]),
    MenuItem.find({ restaurant: restaurantObjectId, active: true })
      .select('name available')
      .sort('name')
      .limit(101)
      .lean(),
  ]);

  const weeklyRows = weekly[0] || {};
  const thisWeekToDate = salesMetric(weeklyRows.thisWeekToDate?.[0]);
  const previousWeekSamePeriod = salesMetric(weeklyRows.previousWeekSamePeriod?.[0]);
  const lastCompletedWeek = salesMetric(weeklyRows.lastCompletedWeek?.[0]);
  const dailyRows = daily.map((row) => ({ date: row._id, ...salesMetric(row) }));
  const lastSevenDaysStart = new Date(today.getTime() - 6 * DAY_MS);
  const previousSevenDaysStart = new Date(lastSevenDaysStart.getTime() - 7 * DAY_MS);
  const salesInRange = (start, end) => sumSales(dailyRows.filter((row) => {
    const date = new Date(`${row.date}T00:00:00`);
    return date >= start && date < end;
  }));
  const lastSevenDays = salesInRange(lastSevenDaysStart, new Date(today.getTime() + DAY_MS));
  const previousSevenDays = salesInRange(previousSevenDaysStart, lastSevenDaysStart);
  const inventorySummary = inventory[0] || {};
  const lowStockItems = inventorySummary.lowStock || [];
  const usageItemIds = usage.map((row) => row._id).filter(Boolean);
  const usedItems = usageItemIds.length
    ? await InventoryItem.find({ _id: { $in: usageItemIds }, restaurant: restaurantObjectId }).select('name unit').lean()
    : [];
  const usageById = new Map(usage.map((row) => [String(row._id), Number(row.quantityUsed) || 0]));
  const usageByItem = new Map(usedItems.map((item) => [
    String(item._id),
    { name: item.name, unit: item.unit, quantityUsed: round2(usageById.get(String(item._id)) || 0) },
  ]));
  const salesByMenuId = new Map(itemSales.map((row) => [String(row._id), row]));
  const analyzedMenuItems = menuItems.slice(0, 100);
  const lowestSellingItems = analyzedMenuItems
    .map((item) => {
      const sales = salesByMenuId.get(String(item._id));
      return {
        name: item.name,
        available: item.available,
        unitsSold: Number(sales?.unitsSold) || 0,
        grossRevenue: round2(Number(sales?.grossRevenue) || 0),
      };
    })
    .sort((a, b) => a.unitsSold - b.unitsSold || a.name.localeCompare(b.name))
    .slice(0, 5);
  const inventoryCounts = inventorySummary.counts?.[0] || {};
  const lowStockCounts = inventorySummary.lowStockCounts?.[0] || {};

  return {
    currency: restaurant.currency || 'PKR',
    timeZone,
    windows: {
      thisWeekStart: dateKey(weekStart, timeZone),
      thisWeekThrough: dateKey(now, timeZone),
      previousWeekSamePeriodStart: dateKey(previousWeekStart, timeZone),
      previousWeekSamePeriodThrough: dateKey(previousWeekSamePeriodEnd, timeZone),
      lastSevenDaysStart: dateKey(lastSevenDaysStart, timeZone),
      previousSevenDaysStart: dateKey(previousSevenDaysStart, timeZone),
      last30DaysStart: dateKey(thirtyDayStart, timeZone),
    },
    sales: {
      thisWeekToDate,
      previousWeekSamePeriod,
      lastCompletedWeek,
      weekToDateNetSalesChangePercent: percentChange(thisWeekToDate.netSales, previousWeekSamePeriod.netSales),
      lastSevenDays,
      previousSevenDays,
      lastSevenDaysNetSalesChangePercent: percentChange(lastSevenDays.netSales, previousSevenDays.netSales),
      dailyTrend: dailyRows.slice(-14),
    },
    bestSellingItems: itemSales.slice(0, 8).map((row) => ({
      name: row.name || 'Unnamed item',
      unitsSold: Number(row.unitsSold) || 0,
      grossRevenue: round2(Number(row.grossRevenue) || 0),
    })),
    lowestSellingItems,
    menuPerformanceWindowDays: 30,
    menuPerformanceBasis: 'Units sold only; this is not a profitability or margin measure.',
    activeMenuItemsAnalyzed: analyzedMenuItems.length,
    moreActiveMenuItemsExist: menuItems.length > 100,
    busiestHours: hourly.map((row) => ({
      hour: `${String(row._id).padStart(2, '0')}:00–${String((row._id + 1) % 24).padStart(2, '0')}:00`,
      paidOrders: row.paidOrders,
    })),
    inventory: {
      totalItems: inventoryCounts.total || 0,
      lowStockCount: lowStockCounts.total || 0,
      lowStockItems,
      lowStockListTruncated: (lowStockCounts.total || 0) > lowStockItems.length,
      topIngredientUsageLast30Days: [...usageByItem.values()],
    },
    dataAvailability: {
      paidOrdersInLast30Days: dailyRows.reduce((total, row) => total + row.paidOrders, 0),
      explicitFoodWasteTracking: false,
    },
  };
}
