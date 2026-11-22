// db.js — local SQLite storage for Amant's Restaurant (Expo)

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './menuData';
import { SERVICE_CHARGE_PERCENT } from './cartLogic';
import { ORDER_STATUSES } from './orderLogic';

const DB_NAME = 'amants_restaurant.db';
const ITERATIONS = 10000;

let dbPromise = null;

// Guest selection is kept locally for this running app session.
let guestSelectedTableId = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          iterations INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS restaurant_tables (
          id INTEGER PRIMARY KEY,
          section TEXT NOT NULL,
          seats INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'available'
            CHECK (status IN ('available', 'occupied', 'held')),
          held_by INTEGER REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
          image_url TEXT,
          category_id INTEGER NOT NULL REFERENCES categories(id),
          ingredients TEXT NOT NULL DEFAULT '[]',
          allergen_info TEXT,
          dietary_labels TEXT NOT NULL DEFAULT '[]',
          prep_minutes INTEGER NOT NULL DEFAULT 10,
          is_available INTEGER NOT NULL DEFAULT 1,
          is_featured INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_products_category
          ON products(category_id);

        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          request_key TEXT UNIQUE,
          user_id INTEGER REFERENCES users(id),
          customer_name TEXT NOT NULL DEFAULT 'Guest',
          guest_names TEXT NOT NULL DEFAULT '[]',
          payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
          table_id INTEGER NOT NULL REFERENCES restaurant_tables(id),
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN (${ORDER_STATUSES.map((x) => `'${x}'`).join(', ')})),
          subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
          service_charge_cents INTEGER NOT NULL DEFAULT 0
            CHECK (service_charge_cents >= 0),
          total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
          special_instructions TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

        CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
          product_name_snapshot TEXT NOT NULL,
          unit_price_cents_snapshot INTEGER NOT NULL
            CHECK (unit_price_cents_snapshot >= 0),
          quantity INTEGER NOT NULL CHECK (quantity >= 1),
          selected_options TEXT NOT NULL DEFAULT '[]',
          special_instructions TEXT,
          line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_order_items_order
          ON order_items(order_id);

        CREATE TABLE IF NOT EXISTS app_migrations (
          migration_key TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      // Upgrade older databases so orders can belong to guests (user_id = NULL).
      await migrateGuestOrders(db);
      await migratePaymentMethod(db);

      await seedTables(db);
      await seedMenu(db);

      // Guest selections are session-only. If the app was restarted,
      // the previous guest selection is no longer valid.
      // Release abandoned guest holds so they don't appear occupied.
      await db.runAsync(`
        UPDATE restaurant_tables
        SET status = 'available', held_by = NULL
        WHERE status = 'held' AND held_by IS NULL
      `);

      return db;
    })();
  }

  return dbPromise;
}

// Existing installations may have orders.user_id declared NOT NULL.
// Rebuild only the orders table, preserving existing orders and order_items.
// Foreign keys are disabled only for the short rebuild operation.
async function migrateGuestOrders(db) {
  const columns = await db.getAllAsync('PRAGMA table_info(orders)');
  const userIdColumn = columns.find((column) => column.name === 'user_id');
  const hasCustomerName = columns.some((column) => column.name === 'customer_name');
  const hasGuestNames = columns.some((column) => column.name === 'guest_names');

  if (userIdColumn && userIdColumn.notnull === 0 && hasCustomerName && hasGuestNames) {
    return;
  }

  await db.execAsync('PRAGMA foreign_keys = OFF');

  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE orders_guest_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          request_key TEXT UNIQUE,
          user_id INTEGER REFERENCES users(id),
          customer_name TEXT NOT NULL DEFAULT 'Guest',
          guest_names TEXT NOT NULL DEFAULT '[]',
          table_id INTEGER NOT NULL REFERENCES restaurant_tables(id),
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN (${ORDER_STATUSES.map((x) => `'${x}'`).join(', ')})),
          subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
          service_charge_cents INTEGER NOT NULL DEFAULT 0
            CHECK (service_charge_cents >= 0),
          total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
          special_instructions TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO orders_guest_migration (
          id, order_number, request_key, user_id, customer_name, guest_names,
          table_id, status, subtotal_cents, service_charge_cents, total_cents,
          special_instructions, created_at, updated_at
        )
        SELECT
          o.id, o.order_number, o.request_key, o.user_id,
          COALESCE((SELECT full_name FROM users WHERE users.id = o.user_id), 'Guest'),
          '[]',
          o.table_id, o.status, o.subtotal_cents, o.service_charge_cents,
          o.total_cents, o.special_instructions, o.created_at, o.updated_at
        FROM orders AS o;

        DROP TABLE orders;
        ALTER TABLE orders_guest_migration RENAME TO orders;

        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      `);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON');
  }
}

// Add the payment method to databases created before this feature.
async function migratePaymentMethod(db) {
  const columns = await db.getAllAsync('PRAGMA table_info(orders)');
  if (!columns.some((column) => column.name === 'payment_method')) {
    await db.execAsync(
      "ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card'))"
    );
  }
}

// ---------- SEED DATA ----------

// All demo tables start available.
// Actual occupancy should be determined by real restaurant activity.
const SEED_TABLES = [
  [1, 'Window Seating', 2, 'available'],
  [2, 'Window Seating', 2, 'available'],
  [3, 'Window Seating', 4, 'available'],
  [4, 'Window Seating', 4, 'available'],
  [5, 'Main Dining Area', 4, 'available'],
  [6, 'Main Dining Area', 4, 'available'],
  [7, 'Main Dining Area', 2, 'available'],
  [8, 'Main Dining Area', 4, 'available'],
  [9, 'Main Dining Area', 4, 'available'],
  [10, 'Main Dining Area', 2, 'available'],
  [11, 'Private Dining', 6, 'available'],
  [12, 'Private Dining', 6, 'available'],
];

async function seedTables(db) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM restaurant_tables'
  );

  if (!row || row.n === 0) {
    for (const table of SEED_TABLES) {
      await db.runAsync(
        `INSERT INTO restaurant_tables
         (id, section, seats, status)
         VALUES (?, ?, ?, ?)`,
        table
      );
    }
  }

  // Remove the original fake occupied seed statuses from existing databases.
  // Never free a table that has an actual order associated with it.
  const migration = await db.getFirstAsync(
    `SELECT migration_key
     FROM app_migrations
     WHERE migration_key = 'remove_fake_seed_occupancy_v1'`
  );

  if (!migration) {
    await db.runAsync(
      `UPDATE restaurant_tables
       SET status = 'available', held_by = NULL
       WHERE id IN (3, 7, 10)
         AND status = 'occupied'
         AND NOT EXISTS (
           SELECT 1
           FROM orders
           WHERE orders.table_id = restaurant_tables.id
         )`
    );

    await db.runAsync(
      `INSERT INTO app_migrations (migration_key)
       VALUES ('remove_fake_seed_occupancy_v1')`
    );
  }
}

async function seedMenu(db) {
  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM categories'
  );

  if (row && row.n > 0) return;

  let order = 1;

  for (const [slug, name, description] of SEED_CATEGORIES) {
    await db.runAsync(
      `INSERT INTO categories
       (slug, name, description, display_order)
       VALUES (?, ?, ?, ?)`,
      [slug, name, description, order++]
    );
  }

  for (const d of SEED_PRODUCTS) {
    await db.runAsync(
      `INSERT INTO products
       (name, description, price_cents, image_url, category_id,
        ingredients, allergen_info, dietary_labels, prep_minutes,
        is_available, is_featured)
       VALUES (?, ?, ?, ?,
        (SELECT id FROM categories WHERE slug = ?),
        ?, ?, ?, ?, ?, ?)`,
      [
        d.name,
        d.description,
        d.cents,
        d.image,
        d.cat,
        JSON.stringify(d.ingredients),
        d.allergenInfo ? JSON.stringify(d.allergenInfo) : null,
        JSON.stringify(d.dietary),
        d.prep,
        d.available ? 1 : 0,
        d.featured ? 1 : 0,
      ]
    );
  }
}

// ---------- AUTHENTICATION ----------

async function hashPassword(password, saltHex, iterations) {
  const key = await pbkdf2Async(
    sha256,
    password,
    saltHex,
    { c: iterations, dkLen: 32 }
  );

  return bytesToHex(key);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

const normEmail = (email) =>
  String(email || '').trim().toLowerCase();

export async function registerUser({ name, email, password }) {
  const fullName = String(name || '').trim();
  const mail = normEmail(email);

  if (!fullName || !mail || String(password || '').length < 8) {
    return {
      ok: false,
      error: 'Please check your details and try again.',
    };
  }

  try {
    const db = await getDb();
    const salt = bytesToHex(Crypto.getRandomBytes(16));
    const hash = await hashPassword(password, salt, ITERATIONS);

    const res = await db.runAsync(
      `INSERT INTO users
       (full_name, email, password_hash, salt, iterations)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, mail, hash, salt, ITERATIONS]
    );

    return {
      ok: true,
      user: {
        id: res.lastInsertRowId,
        fullName,
        email: mail,
      },
    };
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return {
        ok: false,
        error: 'An account with this email already exists. Try logging in.',
      };
    }

    return {
      ok: false,
      error: 'We could not save your account. Please try again.',
    };
  }
}

export async function loginUser({ email, password }) {
  try {
    const db = await getDb();

    const row = await db.getFirstAsync(
      `SELECT id, full_name, email, password_hash, salt, iterations
       FROM users WHERE email = ?`,
      [normEmail(email)]
    );

    const bad = {
      ok: false,
      error: 'Email or password is incorrect.',
    };

    if (!row) return bad;

    const hash = await hashPassword(
      password,
      row.salt,
      row.iterations
    );

    if (!safeEqual(hash, row.password_hash)) return bad;

    return {
      ok: true,
      user: {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: 'We could not read the database. Please try again.',
    };
  }
}

export async function countUsers() {
  const db = await getDb();

  const row = await db.getFirstAsync(
    'SELECT COUNT(*) AS n FROM users'
  );

  return row ? row.n : 0;
}

// ---------- TABLE SELECTION ----------

const padNum = (n) => String(n).padStart(2, '0');

// Supports both:
// getTables()       -> guest
// getTables(userId) -> existing account

export async function getTables(userId = null) {
  const db = await getDb();

  const rows = await db.getAllAsync(
    `SELECT id, section, seats, status, held_by
     FROM restaurant_tables
     ORDER BY id`
  );

  return rows.map((r) => {
    let state = 'available';

    if (r.status === 'occupied') {
      state = 'occupied';
    } else if (r.status === 'held') {
      if (
        userId != null &&
        r.held_by === Number(userId)
      ) {
        state = 'selected';
      } else if (
        userId == null &&
        r.held_by == null &&
        guestSelectedTableId === r.id
      ) {
        state = 'selected';
      } else {
        state = 'occupied';
      }
    }

    return {
      id: r.id,
      section: r.section,
      seats: r.seats,
      state,
    };
  });
}

// Supports both:
// selectTable(tableId)          -> guest
// selectTable(userId, tableId)  -> existing account

export async function selectTable(first, second) {
  const isGuest = second === undefined;

  const userId = isGuest ? null : Number(first);
  const tableId = Number(isGuest ? first : second);

  if (
    !Number.isInteger(tableId) ||
    (!isGuest && !Number.isInteger(userId))
  ) {
    return {
      ok: false,
      error: 'That table does not exist.',
    };
  }

  try {
    const db = await getDb();

    let result = {
      ok: false,
      error: 'We could not select that table. Please try again.',
    };

    await db.withTransactionAsync(async () => {
      const table = await db.getFirstAsync(
        `SELECT id, status, held_by
         FROM restaurant_tables
         WHERE id = ?`,
        [tableId]
      );

      if (!table) {
        result = {
          ok: false,
          error: 'That table does not exist.',
        };
        return;
      }

      // The same guest/account already has this table.
      if (
        table.status === 'held' &&
        (
          (isGuest && table.held_by == null &&
            guestSelectedTableId === tableId) ||
          (!isGuest && table.held_by === userId)
        )
      ) {
        result = { ok: true, tableId };
        return;
      }

      if (table.status !== 'available') {
        result = {
          ok: false,
          error: `Table ${padNum(tableId)} is not available. Please choose another table.`,
        };
        return;
      }

      // Release this guest's previous selection.
      if (isGuest) {
        await db.runAsync(
          `UPDATE restaurant_tables
           SET status = 'available', held_by = NULL
           WHERE status = 'held' AND held_by IS NULL`
        );
      } else {
        await db.runAsync(
          `UPDATE restaurant_tables
           SET status = 'available', held_by = NULL
           WHERE held_by = ? AND status = 'held'`,
          [userId]
        );
      }

      // Claim the new table only if it is still available.
      let update;

      if (isGuest) {
        update = await db.runAsync(
          `UPDATE restaurant_tables
           SET status = 'held', held_by = NULL
           WHERE id = ? AND status = 'available'`,
          [tableId]
        );
      } else {
        update = await db.runAsync(
          `UPDATE restaurant_tables
           SET status = 'held', held_by = ?
           WHERE id = ? AND status = 'available'`,
          [userId, tableId]
        );
      }

      if (update.changes === 1) {
        result = { ok: true, tableId };
      } else {
        result = {
          ok: false,
          error: `Table ${padNum(tableId)} was just taken. Please choose another table.`,
        };
      }
    });

    if (result.ok && isGuest) {
      guestSelectedTableId = tableId;
    }

    return result;
  } catch (e) {
    return {
      ok: false,
      error: 'We could not select that table. Please try again.',
    };
  }
}

// Supports both:
// confirmTable(tableId)          -> guest
// confirmTable(userId, tableId)  -> existing account

export async function confirmTable(first, second) {
  const isGuest = second === undefined;

  const userId = isGuest ? null : Number(first);
  const tableId = Number(isGuest ? first : second);

  if (
    !Number.isInteger(tableId) ||
    (!isGuest && !Number.isInteger(userId))
  ) {
    return {
      ok: false,
      error: 'That table does not exist.',
    };
  }

  try {
    const db = await getDb();

    let table;

    if (isGuest) {
      if (guestSelectedTableId !== tableId) {
        return {
          ok: false,
          error: 'Your table is no longer selected. Please choose again.',
        };
      }

      table = await db.getFirstAsync(
        `SELECT id, section, seats
         FROM restaurant_tables
         WHERE id = ? AND status = 'held' AND held_by IS NULL`,
        [tableId]
      );
    } else {
      table = await db.getFirstAsync(
        `SELECT id, section, seats
         FROM restaurant_tables
         WHERE id = ? AND status = 'held' AND held_by = ?`,
        [tableId, userId]
      );
    }

    if (!table) {
      return {
        ok: false,
        error: 'Your table is no longer held. Please choose a table again.',
      };
    }

    return {
      ok: true,
      table: {
        id: table.id,
        section: table.section,
        seats: table.seats,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: 'We could not confirm your table. Please try again.',
    };
  }
}

export async function releaseTable(userId = null) {
  try {
    const db = await getDb();

    if (userId == null) {
      await db.runAsync(
        `UPDATE restaurant_tables
         SET status = 'available', held_by = NULL
         WHERE status = 'held' AND held_by IS NULL`
      );

      guestSelectedTableId = null;
    } else {
      await db.runAsync(
        `UPDATE restaurant_tables
         SET status = 'available', held_by = NULL
         WHERE held_by = ? AND status = 'held'`,
        [userId]
      );
    }
  } catch (e) {
    // Nothing to release.
  }
}

// ---------- MENU ----------

function safeJson(text, fallback) {
  try {
    const value = JSON.parse(text);
    return value === undefined ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

export async function getMenu() {
  const db = await getDb();

  const categories = await db.getAllAsync(
    `SELECT id, slug, name, description, image_url, display_order
     FROM categories
     WHERE is_active = 1
     ORDER BY display_order, id`
  );

  const rows = await db.getAllAsync(
    `SELECT p.id, p.name, p.description, p.price_cents,
            p.image_url, p.category_id, p.ingredients,
            p.allergen_info, p.dietary_labels, p.prep_minutes,
            p.is_available, p.is_featured
     FROM products p
     JOIN categories c ON c.id = p.category_id
     WHERE c.is_active = 1
     ORDER BY c.display_order, p.id`
  );

  return {
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
    })),

    products: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      priceCents: r.price_cents,
      imageUrl: r.image_url,
      categoryId: r.category_id,
      ingredients: safeJson(r.ingredients, []),
      allergenInfo:
        r.allergen_info == null
          ? null
          : safeJson(r.allergen_info, null),
      dietary: safeJson(r.dietary_labels, []),
      prepMinutes: r.prep_minutes,
      available: r.is_available === 1,
      featured: r.is_featured === 1,
    })),
  };
}

// ---------- ORDERS ----------

const MAX_LINES = 50;
const MAX_QTY = 20;

async function loadOrder(db, id) {
  const o = await db.getFirstAsync(
    `SELECT id, order_number, user_id, customer_name, guest_names,
            table_id, status, subtotal_cents, service_charge_cents,
            total_cents, payment_method, special_instructions, created_at
     FROM orders WHERE id = ?`,
    [id]
  );

  if (!o) return null;

  const items = await db.getAllAsync(
    `SELECT product_id, product_name_snapshot,
            unit_price_cents_snapshot, quantity,
            selected_options, special_instructions,
            line_total_cents
     FROM order_items
     WHERE order_id = ?
     ORDER BY id`,
    [id]
  );

  return {
    id: o.id,
    orderNumber: o.order_number,
    userId: o.user_id,
    customerName: o.customer_name || 'Guest',
    guestNames: safeJson(o.guest_names, []),
    tableId: o.table_id,
    status: o.status,
    subtotalCents: o.subtotal_cents,
    serviceChargeCents: o.service_charge_cents,
    totalCents: o.total_cents,
    paymentMethod: o.payment_method || 'cash',
    note: o.special_instructions || '',
    createdAt: o.created_at,

    items: items.map((i) => ({
      productId: i.product_id,
      name: i.product_name_snapshot,
      unitCents: i.unit_price_cents_snapshot,
      quantity: i.quantity,
      options: safeJson(i.selected_options, []),
      instructions: i.special_instructions || '',
      lineTotalCents: i.line_total_cents,
    })),
  };
}

export async function placeOrder({
  userId,
  customerName,
  guestNames,
  paymentMethod = 'cash',
  tableId,
  lines,
  note,
  expectedTotalCents,
  requestKey,
}) {
  const fail = (code, error, extra = {}) => ({
    ok: false,
    code,
    error,
    ...extra,
  });

  const isGuest = userId == null;
  const uid = isGuest ? null : Number(userId);
  const cleanCustomerName = String(customerName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const cleanPaymentMethod = String(paymentMethod || '').toLowerCase();

  if (!['cash', 'card'].includes(cleanPaymentMethod)) {
    return fail('INVALID_PAYMENT', 'Please choose cash or card as your payment method.');
  }

  const cleanGuestNames = Array.isArray(guestNames)
    ? guestNames
        .map((name) => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 80))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  if (!isGuest && !Number.isInteger(uid)) {
    return fail('INVALID', 'Please log in again.');
  }

  if (isGuest && !cleanCustomerName) {
    return fail('INVALID', 'Please enter your name before placing the order.');
  }

  const tid = Number(tableId);

  if (!Number.isInteger(tid)) {
    return fail('INVALID_TABLE', 'That table does not exist.');
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return fail('EMPTY', 'Your cart is empty.');
  }

  if (lines.length > MAX_LINES) {
    return fail('INVALID', 'There are too many different dishes in one order.');
  }

  const clean = [];

  for (const l of lines) {
    const productId = Number(l && l.productId);
    const quantity = Number(l && l.quantity);

    if (
      !Number.isInteger(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QTY
    ) {
      return fail(
        'INVALID',
        'Something in your cart is not valid. Please review it and try again.'
      );
    }

    clean.push({
      productId,
      quantity,
      instructions: String((l && l.instructions) || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 140),
      options: Array.isArray(l.options)
        ? l.options.map(String).slice(0, 20)
        : [],
    });
  }

  const orderNote = String(note || '').trim().slice(0, 200);
  const key = requestKey ? String(requestKey).slice(0, 80) : null;

  try {
    const db = await getDb();

    let result = fail(
      'FAILED',
      'We could not place your order. Please try again.'
    );

    await db.withTransactionAsync(async () => {
      if (key) {
        const existing = await db.getFirstAsync(
          `SELECT id FROM orders
           WHERE request_key = ?
             AND ((user_id IS NULL AND ? IS NULL) OR user_id = ?)`,
          [key, uid, uid]
        );

        if (existing) {
          result = {
            ok: true,
            duplicate: true,
            order: await loadOrder(db, existing.id),
          };
          return;
        }
      }

      let t = null;

      if (isGuest) {
        // Guest table holds are tracked in memory for this app session.
        if (guestSelectedTableId === tid) {
          t = await db.getFirstAsync(
            `SELECT id FROM restaurant_tables
             WHERE id = ? AND status = 'held' AND held_by IS NULL`,
            [tid]
          );
        }
      } else {
        t = await db.getFirstAsync(
          `SELECT id FROM restaurant_tables
           WHERE id = ? AND status = 'held' AND held_by = ?`,
          [tid, uid]
        );
      }

      if (!t) {
        result = fail(
          'TABLE',
          'Your table is no longer reserved for you. Please choose your table again.'
        );
        return;
      }

      const unavailable = [];
      const priced = [];
      const prices = {};

      for (const l of clean) {
        const p = await db.getFirstAsync(
          `SELECT p.id, p.name, p.price_cents, p.is_available
           FROM products p
           JOIN categories c ON c.id = p.category_id
           WHERE p.id = ? AND c.is_active = 1`,
          [l.productId]
        );

        if (!p) {
          unavailable.push({
            productId: l.productId,
            name: 'A dish in your cart',
          });
          continue;
        }

        prices[p.id] = p.price_cents;

        if (p.is_available !== 1) {
          unavailable.push({
            productId: p.id,
            name: p.name,
          });
          continue;
        }

        priced.push({
          ...l,
          name: p.name,
          unitCents: p.price_cents,
        });
      }

      if (unavailable.length) {
        const names = [
          ...new Set(unavailable.map((u) => u.name)),
        ].join(', ');

        result = fail(
          'UNAVAILABLE',
          `${names} ${unavailable.length === 1 ? 'is' : 'are'} no longer available.`,
          { unavailable }
        );

        return;
      }

      const subtotal = priced.reduce(
        (sum, l) => sum + l.unitCents * l.quantity,
        0
      );

      const service = Math.round(
        (subtotal * SERVICE_CHARGE_PERCENT) / 100
      );

      const total = subtotal + service;

      if (
        Number.isInteger(expectedTotalCents) &&
        expectedTotalCents !== total
      ) {
        result = fail(
          'PRICE_CHANGED',
          'Some prices have changed since you added these dishes.',
          {
            prices,
            serverTotalCents: total,
          }
        );

        return;
      }

      const temp = `PENDING-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      const ins = await db.runAsync(
        `INSERT INTO orders
         (order_number, request_key, user_id, customer_name, guest_names, payment_method,
          table_id, status, subtotal_cents, service_charge_cents, total_cents,
          special_instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [
          temp,
          key,
          uid,
          cleanCustomerName || 'Guest',
          JSON.stringify(cleanGuestNames),
          cleanPaymentMethod,
          tid,
          subtotal,
          service,
          total,
          orderNote || null,
        ]
      );

      const orderId = ins.lastInsertRowId;

      await db.runAsync(
        'UPDATE orders SET order_number = ? WHERE id = ?',
        [`AM-${String(orderId).padStart(4, '0')}`, orderId]
      );

      for (const l of priced) {
        await db.runAsync(
          `INSERT INTO order_items
           (order_id, product_id, product_name_snapshot,
            unit_price_cents_snapshot, quantity, selected_options,
            special_instructions, line_total_cents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            l.productId,
            l.name,
            l.unitCents,
            l.quantity,
            JSON.stringify(l.options),
            l.instructions || null,
            l.unitCents * l.quantity,
          ]
        );
      }

      result = {
        ok: true,
        order: await loadOrder(db, orderId),
      };
    });

    return result;
  } catch (e) {
    return fail(
      'FAILED',
      'We could not place your order. Please try again.'
    );
  }
}

export async function getOrder(orderId, userId) {
  try {
    const db = await getDb();
    const order = await loadOrder(db, Number(orderId));

    return order && order.userId === userId ? order : null;
  } catch (e) {
    return null;
  }
}