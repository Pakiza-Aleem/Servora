import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as M from './models.js';
import { calcTotals } from './utils/calc.js';

if (
  process.env.NODE_ENV === 'production' &&
  process.env.ALLOW_SEED !== 'true'
) {
  throw new Error(
    'Seeding WIPES the database. Set ALLOW_SEED=true to confirm.'
  );
}

try {
  // Connect to MongoDB
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from server/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  console.log(
    `Connected to MongoDB database: ${mongoose.connection.name}`
  );

  // Fix the outdated order idempotency index.
  const indexes = await M.Order.collection.indexes();

  const oldIndex = indexes.find(
    (index) => index.name === 'restaurant_1_idempotencyKey_1'
  );

  if (oldIndex && !oldIndex.partialFilterExpression) {
    await M.Order.collection.dropIndex(
      'restaurant_1_idempotencyKey_1'
    );

    console.log('Removed outdated order idempotency index.');
  }

  // Ensure the indexes match the model definitions.
  await M.Order.syncIndexes();

  console.log('Order indexes synchronized.');

  // WARNING: Clear existing application data before reseeding.
  await Promise.all(
    Object.values(M)
      .filter(
        (model) =>
          model && typeof model.deleteMany === 'function'
      )
      .map((model) => model.deleteMany({}))
  );

  console.log('Existing records cleared.');

  // Restaurant
  const rest = await M.Restaurant.create({
    name: 'Servora Bistro',
    taxRate: 16,
    currency: 'PKR',
  });

  const R = rest._id;

  // Branch
  const branch = await M.Branch.create({
    restaurant: R,
    name: 'Main Branch',
    address: 'Lahore',
  });

  // Demo users
  const passwordHash = await bcrypt.hash('Servora@123', 10);

  const users = await M.User.insertMany(
    [
      ['Ayesha Khan', 'owner'],
      ['Bilal Ahmed', 'manager'],
      ['Sana Malik', 'cashier'],
      ['Chef Imran', 'kitchen'],
      ['Hamza Ali', 'waiter'],
    ].map(([name, role]) => ({
      restaurant: R,
      branch: branch._id,
      name,
      role,
      email: `${role}@servora.test`,
      passwordHash,
    }))
  );

  // Inventory
  const inv = Object.fromEntries(
    (
      await M.InventoryItem.insertMany(
        [
          ['Chicken', 'kg', 40, 8, 650],
          ['Beef', 'kg', 30, 8, 1400],
          ['Rice', 'kg', 60, 10, 280],
          ['Flour', 'kg', 50, 10, 120],
          ['Cheese', 'kg', 12, 4, 1300],
          ['Tomato', 'kg', 20, 5, 140],
          ['Cooking oil', 'l', 25, 6, 520],
          ['Coffee beans', 'kg', 6, 2, 3200],
          ['Milk', 'l', 30, 10, 220],
          ['Lemon', 'kg', 3, 3, 300],
        ].map(([name, unit, quantity, minStock, costPerUnit]) => ({
          restaurant: R,
          name,
          unit,
          quantity,
          minStock,
          costPerUnit,
        }))
      )
    ).map((item) => [item.name, item._id])
  );

  // Menu categories
  const cats = Object.fromEntries(
    (
      await M.MenuCategory.insertMany(
        [
          'Starters',
          'Mains',
          'Grill',
          'Pizza & Pasta',
          'Desserts',
          'Beverages',
        ].map((name, sort) => ({
          restaurant: R,
          name,
          sort,
        }))
      )
    ).map((category) => [category.name, category._id])
  );

  // Recipe helper
  const rec = (...ingredients) =>
    ingredients.map(([name, qty]) => ({
      ingredient: inv[name],
      qty,
    }));

  // Menu items
  const items = await M.MenuItem.insertMany(
    [
      [
        'Starters',
        'Chicken Samosa (4 pc)',
        450,
        'Crisp pastry, spiced chicken',
        'kitchen',
        rec(
          ['Chicken', 0.15],
          ['Flour', 0.1],
          ['Cooking oil', 0.1]
        ),
      ],
      [
        'Starters',
        'Bruschetta',
        550,
        'Tomato, basil, toasted sourdough',
        'kitchen',
        rec(['Tomato', 0.15], ['Flour', 0.1]),
      ],
      [
        'Starters',
        'Crispy Calamari',
        950,
        'Lemon aioli',
        'kitchen',
        rec(['Cooking oil', 0.1], ['Lemon', 0.05]),
      ],
      [
        'Starters',
        'Tomato Basil Soup',
        480,
        'Roasted tomato, cream',
        'kitchen',
        rec(['Tomato', 0.3]),
      ],
      [
        'Mains',
        'Chicken Karahi',
        1650,
        'Wok-cooked, fresh ginger',
        'kitchen',
        rec(
          ['Chicken', 0.5],
          ['Tomato', 0.3],
          ['Cooking oil', 0.08]
        ),
      ],
      [
        'Mains',
        'Beef Nihari',
        1850,
        'Slow-cooked overnight',
        'kitchen',
        rec(['Beef', 0.5], ['Flour', 0.05]),
      ],
      [
        'Mains',
        'Chicken Biryani',
        1250,
        'Aged basmati, saffron',
        'kitchen',
        rec(['Chicken', 0.3], ['Rice', 0.25]),
      ],
      [
        'Mains',
        'Grilled Salmon',
        3200,
        'Lemon butter, greens',
        'grill',
        rec(['Lemon', 0.05]),
      ],
      [
        'Mains',
        'Mutton Pulao',
        1750,
        'Fragrant yakhni rice',
        'kitchen',
        rec(['Beef', 0.3], ['Rice', 0.25]),
      ],
      [
        'Grill',
        'Beef Seekh Kebab',
        1350,
        'Charcoal grilled, mint chutney',
        'grill',
        rec(['Beef', 0.25]),
      ],
      [
        'Grill',
        'Chicken Tikka',
        1450,
        'Yoghurt marinade, charred',
        'grill',
        rec(['Chicken', 0.35]),
      ],
      [
        'Grill',
        'Ribeye Steak',
        4200,
        '300g, peppercorn sauce',
        'grill',
        rec(['Beef', 0.3]),
      ],
      [
        'Pizza & Pasta',
        'Margherita Pizza',
        1350,
        'San Marzano, mozzarella',
        'kitchen',
        rec(
          ['Flour', 0.25],
          ['Cheese', 0.15],
          ['Tomato', 0.15]
        ),
      ],
      [
        'Pizza & Pasta',
        'Chicken Alfredo',
        1550,
        'Creamy parmesan sauce',
        'kitchen',
        rec(
          ['Chicken', 0.2],
          ['Cheese', 0.1],
          ['Flour', 0.15]
        ),
      ],
      [
        'Pizza & Pasta',
        'Penne Arrabbiata',
        1250,
        'Chilli tomato sauce',
        'kitchen',
        rec(['Flour', 0.15], ['Tomato', 0.2]),
      ],
      [
        'Desserts',
        'Chocolate Fondant',
        850,
        'Warm centre, vanilla cream',
        'dessert',
        rec(['Flour', 0.05], ['Milk', 0.1]),
      ],
      [
        'Desserts',
        'Kheer',
        450,
        'Cardamom rice pudding',
        'dessert',
        rec(['Rice', 0.05], ['Milk', 0.25]),
      ],
      [
        'Beverages',
        'Espresso',
        350,
        'Double shot',
        'bar',
        rec(['Coffee beans', 0.02]),
      ],
      [
        'Beverages',
        'Cappuccino',
        450,
        'Velvet milk foam',
        'bar',
        rec(['Coffee beans', 0.02], ['Milk', 0.2]),
      ],
      [
        'Beverages',
        'Fresh Lemonade',
        380,
        'Mint, sea salt',
        'bar',
        rec(['Lemon', 0.1]),
      ],
      [
        'Beverages',
        'Mint Margarita',
        420,
        'Non-alcoholic classic',
        'bar',
        rec(['Lemon', 0.08]),
      ],
    ].map(([category, name, price, description, station, recipe]) => ({
      restaurant: R,
      category: cats[category],
      name,
      price,
      description,
      station,
      recipe,
    }))
  );

  // Pizza modifiers
  await M.MenuItem.updateOne(
    { name: 'Margherita Pizza', restaurant: R },
    {
      modifierGroups: [
        {
          name: 'Size',
          required: true,
          options: [
            { name: 'Regular', price: 0 },
            { name: 'Large', price: 400 },
          ],
        },
        {
          name: 'Extras',
          required: false,
          options: [{ name: 'Extra cheese', price: 150 }],
        },
      ],
    }
  );

  // Cappuccino modifiers
  await M.MenuItem.updateOne(
    { name: 'Cappuccino', restaurant: R },
    {
      modifierGroups: [
        {
          name: 'Milk',
          required: false,
          options: [{ name: 'Oat milk', price: 100 }],
        },
      ],
    }
  );

  // Tables
  const tables = await M.Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurant: R,
      branch: branch._id,
      number: i + 1,
      seats: [2, 2, 4, 4, 4, 6, 6, 4, 8, 2][i],
    }))
  );

  // Customers
  await M.Customer.insertMany(
    [
      ['Usman Tariq', '0300-1112223', 'usman@example.com'],
      ['Maryam Siddiqui', '0321-5556667', 'maryam@example.com'],
    ].map(([name, phone, email]) => ({
      restaurant: R,
      name,
      phone,
      email,
    }))
  );

  // Order helper
  let n = 1000;

  const mk = (daysAgo, hour, status, pay, pick) => {
    const lines = pick.map(([i, qty]) => ({
      menuItem: items[i]._id,
      name: items[i].name,
      price: items[i].price,
      qty,
      station: items[i].station,
    }));

    const totals = calcTotals(lines, { taxRate: 16 });

    const at = new Date(Date.now() - daysAgo * 864e5);
    at.setHours(hour, 10);

    return {
      restaurant: R,
      number: ++n,
      type: ['dine-in', 'takeaway', 'delivery'][n % 3],
      createdBy: users[2]._id,
      items: lines,
      ...totals,
      discountType: 'none',
      status,
      paymentStatus: pay ? 'paid' : 'unpaid',
      payments: pay
        ? [
            {
              method: ['cash', 'card'][n % 2],
              amount: totals.total,
              received: totals.total,
              change: 0,
            },
          ]
        : [],
      history: [{ status }],
      createdAt: at,
      updatedAt: at,
      stockDeducted: true,
    };
  };

  // Completed orders
  const done = [];

  for (let d = 6; d >= 0; d--) {
    for (let k = 0; k < 6; k++) {
      done.push(
        mk(
          d,
          12 + k * 2,
          'completed',
          true,
          [
            [(d + k) % 21, 1 + (k % 2)],
            [(d * 3 + k * 5) % 21, 1],
          ]
        )
      );
    }
  }

  await M.Order.collection.insertMany(
    done.map((order) => ({
      ...order,
      _id: new mongoose.Types.ObjectId(),
    }))
  );

  // Active orders
  for (const [i, status] of [
    [4, 'confirmed'],
    [6, 'preparing'],
    [10, 'ready'],
  ]) {
    const order = mk(
      0,
      new Date().getHours(),
      status,
      false,
      [
        [i, 1],
        [18, 2],
      ]
    );

    order.type = 'dine-in';
    order.table = tables[i % 5]._id;
    order.createdAt = new Date(Date.now() - 6 * 6e4);
    order.updatedAt = order.createdAt;

    await M.Order.collection.insertOne({
      ...order,
      _id: new mongoose.Types.ObjectId(),
    });

    await M.Table.updateOne(
      { _id: order.table },
      { status: 'occupied' }
    );
  }

  // Update order counter
  await M.Restaurant.updateOne(
    { _id: R },
    { orderCounter: n + 1 }
  );

  console.log(
    'Seeded successfully. Login: owner@servora.test / Servora@123'
  );
  console.log(
    'Other demo users: manager@servora.test, cashier@servora.test, kitchen@servora.test, waiter@servora.test'
  );
} catch (error) {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect().catch(() => {});
}