// adminDb.js — every admin read and write. All values go through parameterized SQL,
// multi-row changes run in transactions, and every mutation is written to activity_log.
import { getDb, loadOrder } from './db';
import {
  ACTIVE_ORDER_STATUSES, HOLD_STATUSES, REVENUE_STATUSES, addDays, findConflict, isReservedNow,
  localISODate, nextReservationStatuses, nextStatuses, nowMinutes, round3, stockStatus, tableStatus,
  validateFood, validateIngredient, validateReservation, firstError,
} from './adminLogic';

class UserError extends Error {
  constructor(message) { super(message); this.userMessage = message; }
}

async function txn(db, fn) {
  let out;
  try {
    await db.withTransactionAsync(async () => { out = await fn(); });
    return out;
  } catch (e) {
    if (e && e.userMessage) return { ok: false, error: e.userMessage };
    console.warn('admin transaction failed:', e);
    return { ok: false, error: 'Something went wrong and nothing was changed. Please try again.' };
  }
}

const log = (db, action, entity, entityId, detail) =>
  db.runAsync('INSERT INTO activity_log (action, entity, entity_id, detail) VALUES (?, ?, ?, ?)', [action, entity, entityId == null ? null : String(entityId), detail || null]);

const likeOf = (q) => `%${String(q).trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
const parse = (t, fb) => { try { const v = JSON.parse(t); return v === undefined ? fb : v; } catch (e) { return fb; } };
const in_ = (list) => list.map(() => '?').join(',');

// =====================================================================
// Overview
// =====================================================================
export async function getOverview() {
  const db = await getDb();
  const rev = in_(REVENUE_STATUSES);
  const c = await db.getFirstAsync(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'pending'), 0) AS pending,
            COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
            COALESCE(SUM(CASE WHEN status IN (${rev}) THEN total_cents END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN status IN (${rev}) AND date(created_at, 'localtime') = ? THEN total_cents END), 0) AS today
       FROM orders`,
    [...REVENUE_STATUSES, ...REVENUE_STATUSES, localISODate(new Date())]
  );

  const today = localISODate(new Date());
  const start = addDays(today, -13);
  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const byDay = await db.getAllAsync(
    `SELECT date(created_at, 'localtime') AS d, COUNT(*) AS orders,
            COALESCE(SUM(CASE WHEN status IN (${rev}) THEN total_cents END), 0) AS revenue
       FROM orders WHERE date(created_at, 'localtime') >= ? GROUP BY d`,
    [...REVENUE_STATUSES, start]
  );
  const map = new Map(byDay.map((r) => [r.d, r]));
  const series = days.map((d) => ({ date: d, orders: map.has(d) ? map.get(d).orders : 0, revenueCents: map.has(d) ? map.get(d).revenue : 0 }));

  const popular = await db.getAllAsync(
    `SELECT oi.product_name_snapshot AS name, SUM(oi.quantity) AS quantity
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled' GROUP BY oi.product_name_snapshot ORDER BY quantity DESC, name LIMIT 6`
  );
  const statuses = await db.getAllAsync('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');

  const tables = await listTables();
  const foods = await db.getFirstAsync('SELECT COUNT(*) AS n FROM products');
  const stock = await db.getFirstAsync(
    `SELECT COALESCE(SUM(quantity > 0 AND quantity <= min_stock), 0) AS low, COALESCE(SUM(quantity <= 0), 0) AS out FROM ingredients`
  );
  const recentOrders = await db.getAllAsync(
    `SELECT o.id, o.order_number, o.table_id, o.status, o.total_cents, o.created_at, u.full_name AS customer
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC, o.id DESC LIMIT 5`
  );
  const recentReservations = await db.getAllAsync(
    `SELECT id, guest_name, party_size, res_date, res_time, status, table_id FROM reservations ORDER BY created_at DESC, id DESC LIMIT 5`
  );
  const activity = await db.getAllAsync('SELECT id, action, entity, entity_id, detail, created_at FROM activity_log ORDER BY id DESC LIMIT 8');

  return {
    orders: { total: c.total, pending: c.pending, completed: c.completed, cancelled: c.cancelled },
    revenueCents: c.revenue,
    todayRevenueCents: c.today,
    series,
    popular,
    statuses,
    tables: {
      active: tables.filter((t) => t.status !== 'unavailable').length,
      reserved: tables.filter((t) => t.status === 'reserved').length,
      occupied: tables.filter((t) => t.status === 'occupied').length,
      total: tables.length,
    },
    foods: foods.n,
    lowStock: stock.low,
    outOfStock: stock.out,
    recentOrders,
    recentReservations,
    activity,
  };
}

// =====================================================================
// Orders
// =====================================================================
export async function listOrders({ query = '', status = 'all', tableId = 'all', from = '', to = '' } = {}) {
  const db = await getDb();
  const where = [];
  const args = [];
  if (status !== 'all') { where.push('o.status = ?'); args.push(status); }
  if (tableId !== 'all') { where.push('o.table_id = ?'); args.push(Number(tableId)); }
  if (from) { where.push("date(o.created_at, 'localtime') >= ?"); args.push(from); }
  if (to) { where.push("date(o.created_at, 'localtime') <= ?"); args.push(to); }
  if (String(query).trim()) {
    const like = likeOf(query);
    where.push(`(o.order_number LIKE ? ESCAPE '\\' OR u.full_name LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.product_name_snapshot LIKE ? ESCAPE '\\'))`);
    args.push(like, like, like);
  }
  return db.getAllAsync(
    `SELECT o.id, o.order_number, o.table_id, o.status, o.total_cents, o.created_at, u.full_name AS customer,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY o.created_at DESC, o.id DESC LIMIT 500`,
    args
  );
}

export async function getOrderDetail(id) {
  const db = await getDb();
  const order = await loadOrder(db, Number(id));
  if (!order) return null;
  const u = await db.getFirstAsync('SELECT full_name, email FROM users WHERE id = ?', [order.userId]);
  const inv = await db.getFirstAsync('SELECT state FROM order_inventory WHERE order_id = ?', [order.id]);
  return { ...order, customer: u ? u.full_name : null, customerEmail: u ? u.email : null, inventory: inv ? inv.state : 'none' };
}

// Deducts or restores ingredient stock so it always matches the order status.
// Deduct once when the order first reaches an accepted status; restore once if it is cancelled afterwards.
async function syncInventory(db, orderId, newStatus) {
  const state = await db.getFirstAsync('SELECT state FROM order_inventory WHERE order_id = ?', [orderId]);
  const hold = HOLD_STATUSES.has(newStatus);

  if (hold && (!state || state.state === 'restored')) {
    const needs = await db.getAllAsync(
      `SELECT i.id, i.name, i.unit, i.quantity, SUM(pi.amount * oi.quantity) AS need
         FROM order_items oi
         JOIN product_ingredients pi ON pi.product_id = oi.product_id
         JOIN ingredients i ON i.id = pi.ingredient_id
        WHERE oi.order_id = ? GROUP BY i.id`,
      [orderId]
    );
    const short = needs.filter((n) => round3(n.quantity) < round3(n.need));
    if (short.length) {
      throw new UserError(`Not enough stock to prepare this order: ${short.map((n) => `${n.name} (need ${round3(n.need)} ${n.unit}, have ${round3(n.quantity)} ${n.unit})`).join(', ')}.`);
    }
    for (const n of needs) {
      const left = round3(n.quantity - n.need);
      const r = await db.runAsync("UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ? AND quantity >= ?", [left, n.id, round3(n.need)]);
      if (r.changes !== 1) throw new UserError(`Not enough ${n.name} in stock.`);
      await db.runAsync("INSERT INTO ingredient_movements (ingredient_id, delta, balance_after, reason, order_id) VALUES (?, ?, ?, 'order', ?)", [n.id, -round3(n.need), left, orderId]);
    }
    await db.runAsync(
      "INSERT INTO order_inventory (order_id, state) VALUES (?, 'deducted') ON CONFLICT(order_id) DO UPDATE SET state = 'deducted', updated_at = datetime('now')",
      [orderId]
    );
  } else if (!hold && state && state.state === 'deducted') {
    // Put back exactly what was taken for this order (from the movement ledger).
    const moves = await db.getAllAsync(
      "SELECT ingredient_id AS id, SUM(delta) AS net FROM ingredient_movements WHERE order_id = ? AND reason IN ('order', 'order_restore') GROUP BY ingredient_id",
      [orderId]
    );
    for (const m of moves) {
      if (!(m.net < 0)) continue;
      const give = round3(-m.net);
      const cur = await db.getFirstAsync('SELECT quantity FROM ingredients WHERE id = ?', [m.id]);
      if (!cur) continue;
      const after = round3(cur.quantity + give);
      await db.runAsync("UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ?", [after, m.id]);
      await db.runAsync("INSERT INTO ingredient_movements (ingredient_id, delta, balance_after, reason, order_id) VALUES (?, ?, ?, 'order_restore', ?)", [m.id, give, after, orderId]);
    }
    await db.runAsync("UPDATE order_inventory SET state = 'restored', updated_at = datetime('now') WHERE order_id = ?", [orderId]);
  }
}

export async function updateOrderStatus(orderId, newStatus) {
  const db = await getDb();
  return txn(db, async () => {
    const o = await db.getFirstAsync('SELECT id, order_number, status FROM orders WHERE id = ?', [Number(orderId)]);
    if (!o) throw new UserError('That order no longer exists.');
    if (!nextStatuses(o.status).includes(newStatus)) throw new UserError(`An order that is ${o.status} cannot be changed to ${newStatus}.`);
    await syncInventory(db, o.id, newStatus);
    await db.runAsync("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [newStatus, o.id]);
    await log(db, 'order_status', 'order', o.id, `${o.order_number}: ${o.status} to ${newStatus}`);
    return { ok: true };
  });
}

// Only cancelled orders can be deleted (the sales history of real orders stays intact).
export async function deleteOrder(orderId) {
  const db = await getDb();
  return txn(db, async () => {
    const o = await db.getFirstAsync('SELECT id, order_number, status FROM orders WHERE id = ?', [Number(orderId)]);
    if (!o) throw new UserError('That order no longer exists.');
    if (o.status !== 'cancelled') throw new UserError('Only cancelled orders can be deleted. Cancel the order first.');
    await syncInventory(db, o.id, 'cancelled'); // no-op unless something is still deducted
    await db.runAsync('DELETE FROM orders WHERE id = ?', [o.id]);
    await log(db, 'order_deleted', 'order', o.id, o.order_number);
    return { ok: true };
  });
}

// =====================================================================
// Foods
// =====================================================================
export async function listCategories() {
  const db = await getDb();
  return db.getAllAsync('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY display_order, id');
}

export async function listFoods() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT p.id, p.name, p.description, p.price_cents, p.image_url, p.category_id, c.name AS category, p.ingredients, p.allergen_info,
            p.dietary_labels, p.prep_minutes, p.is_available, p.is_featured
       FROM products p JOIN categories c ON c.id = p.category_id ORDER BY c.display_order, p.name`
  );
  const links = await db.getAllAsync(
    `SELECT pi.product_id, pi.ingredient_id, pi.amount, i.name, i.unit FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id ORDER BY i.name`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    priceCents: r.price_cents,
    imageUrl: r.image_url,
    categoryId: r.category_id,
    category: r.category,
    ingredientsText: parse(r.ingredients, []).join(', '),
    allergenInfo: r.allergen_info == null ? null : parse(r.allergen_info, null),
    dietary: parse(r.dietary_labels, []),
    prepMinutes: r.prep_minutes,
    available: r.is_available === 1,
    featured: r.is_featured === 1,
    recipe: links.filter((l) => l.product_id === r.id).map((l) => ({ ingredientId: l.ingredient_id, name: l.name, unit: l.unit, amount: l.amount })),
  }));
}

// input: { id?, name, description, priceCents, categoryId, imageUrl, prepMinutes, available, featured,
//          ingredientsText, allergenInfo (null = unknown), dietary[], recipe[{ingredientId, amount}] }
export async function saveFood(input) {
  const errors = validateFood(input);
  if (Object.keys(errors).length) return { ok: false, error: firstError(errors), errors };
  const db = await getDb();
  const ingredientsList = String(input.ingredientsText || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 40);
  const allergen = input.allergenInfo ? JSON.stringify({ verified: !!input.allergenInfo.verified, contains: input.allergenInfo.contains || [], mayContain: input.allergenInfo.mayContain || [] }) : null;
  const vals = [
    String(input.name).trim(), String(input.description).trim(), input.priceCents, String(input.imageUrl || '').trim() || null, input.categoryId,
    JSON.stringify(ingredientsList), allergen, JSON.stringify(input.dietary || []), input.prepMinutes, input.available ? 1 : 0, input.featured ? 1 : 0,
  ];
  return txn(db, async () => {
    const cat = await db.getFirstAsync('SELECT id FROM categories WHERE id = ?', [input.categoryId]);
    if (!cat) throw new UserError('That category no longer exists.');
    let id = input.id;
    if (id) {
      const r = await db.runAsync(
        `UPDATE products SET name = ?, description = ?, price_cents = ?, image_url = ?, category_id = ?, ingredients = ?, allergen_info = ?,
                dietary_labels = ?, prep_minutes = ?, is_available = ?, is_featured = ?, updated_at = datetime('now') WHERE id = ?`,
        [...vals, id]
      );
      if (r.changes !== 1) throw new UserError('That food no longer exists.');
    } else {
      const r = await db.runAsync(
        `INSERT INTO products (name, description, price_cents, image_url, category_id, ingredients, allergen_info, dietary_labels, prep_minutes, is_available, is_featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        vals
      );
      id = r.lastInsertRowId;
    }
    if (input.featured) await db.runAsync('UPDATE products SET is_featured = 0 WHERE id != ?', [id]);
    await db.runAsync('DELETE FROM product_ingredients WHERE product_id = ?', [id]);
    for (const l of input.recipe || []) {
      const ing = await db.getFirstAsync('SELECT id FROM ingredients WHERE id = ?', [l.ingredientId]);
      if (!ing) throw new UserError('One of the linked ingredients no longer exists.');
      await db.runAsync('INSERT INTO product_ingredients (product_id, ingredient_id, amount) VALUES (?, ?, ?)', [id, l.ingredientId, round3(l.amount)]);
    }
    await log(db, input.id ? 'food_updated' : 'food_created', 'food', id, String(input.name).trim());
    return { ok: true, id };
  });
}

export async function setFoodAvailable(id, available) {
  const db = await getDb();
  return txn(db, async () => {
    const r = await db.runAsync("UPDATE products SET is_available = ?, updated_at = datetime('now') WHERE id = ?", [available ? 1 : 0, Number(id)]);
    if (r.changes !== 1) throw new UserError('That food no longer exists.');
    await log(db, available ? 'food_enabled' : 'food_disabled', 'food', id, null);
    return { ok: true };
  });
}

export async function deleteFood(id) {
  const db = await getDb();
  return txn(db, async () => {
    const p = await db.getFirstAsync('SELECT name FROM products WHERE id = ?', [Number(id)]);
    if (!p) throw new UserError('That food no longer exists.');
    await db.runAsync('DELETE FROM products WHERE id = ?', [Number(id)]); // past orders keep their name/price snapshot
    await log(db, 'food_deleted', 'food', id, p.name);
    return { ok: true };
  });
}

// =====================================================================
// Ingredients
// =====================================================================
export async function listIngredients() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT id, name, unit, quantity, min_stock FROM ingredients ORDER BY name');
  const links = await db.getAllAsync('SELECT pi.ingredient_id, p.id AS product_id, p.name, pi.amount FROM product_ingredients pi JOIN products p ON p.id = pi.product_id ORDER BY p.name');
  return rows.map((r) => ({
    id: r.id, name: r.name, unit: r.unit, quantity: r.quantity, minStock: r.min_stock,
    status: stockStatus(r.quantity, r.min_stock),
    foods: links.filter((l) => l.ingredient_id === r.id).map((l) => ({ id: l.product_id, name: l.name, amount: l.amount })),
  }));
}

export async function saveIngredient(input) {
  const errors = validateIngredient(input);
  if (Object.keys(errors).length) return { ok: false, error: firstError(errors), errors };
  const db = await getDb();
  const name = String(input.name).trim();
  const quantity = round3(input.quantity);
  const minStock = round3(input.minStock);
  return txn(db, async () => {
    const dup = await db.getFirstAsync('SELECT id FROM ingredients WHERE name = ? COLLATE NOCASE AND id != ?', [name, input.id || 0]);
    if (dup) throw new UserError('An ingredient with this name already exists.');
    if (input.id) {
      const old = await db.getFirstAsync('SELECT quantity FROM ingredients WHERE id = ?', [input.id]);
      if (!old) throw new UserError('That ingredient no longer exists.');
      await db.runAsync("UPDATE ingredients SET name = ?, unit = ?, quantity = ?, min_stock = ?, updated_at = datetime('now') WHERE id = ?", [name, input.unit, quantity, minStock, input.id]);
      if (round3(old.quantity) !== quantity) {
        await db.runAsync("INSERT INTO ingredient_movements (ingredient_id, delta, balance_after, reason, note) VALUES (?, ?, ?, 'adjustment', 'Edited quantity')", [input.id, round3(quantity - old.quantity), quantity]);
      }
      await log(db, 'ingredient_updated', 'ingredient', input.id, name);
      return { ok: true, id: input.id };
    }
    const r = await db.runAsync('INSERT INTO ingredients (name, unit, quantity, min_stock) VALUES (?, ?, ?, ?)', [name, input.unit, quantity, minStock]);
    await db.runAsync("INSERT INTO ingredient_movements (ingredient_id, delta, balance_after, reason, note) VALUES (?, ?, ?, 'create', 'Ingredient created')", [r.lastInsertRowId, quantity, quantity]);
    await log(db, 'ingredient_created', 'ingredient', r.lastInsertRowId, name);
    return { ok: true, id: r.lastInsertRowId };
  });
}

// delta may be negative (use / waste) or positive (restock). Stock can never go below 0.
export async function adjustIngredient(id, delta, reason, note) {
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, error: 'Enter an amount other than 0.' };
  const db = await getDb();
  return txn(db, async () => {
    const cur = await db.getFirstAsync('SELECT name, unit, quantity FROM ingredients WHERE id = ?', [Number(id)]);
    if (!cur) throw new UserError('That ingredient no longer exists.');
    const after = round3(cur.quantity + delta);
    if (after < 0) throw new UserError(`Only ${round3(cur.quantity)} ${cur.unit} of ${cur.name} in stock. Stock cannot go below 0.`);
    await db.runAsync("UPDATE ingredients SET quantity = ?, updated_at = datetime('now') WHERE id = ?", [after, Number(id)]);
    await db.runAsync('INSERT INTO ingredient_movements (ingredient_id, delta, balance_after, reason, note) VALUES (?, ?, ?, ?, ?)', [Number(id), round3(delta), after, reason || 'adjustment', String(note || '').trim().slice(0, 120) || null]);
    await log(db, 'stock_adjusted', 'ingredient', id, `${cur.name}: ${delta > 0 ? '+' : ''}${round3(delta)} ${cur.unit}`);
    return { ok: true, quantity: after };
  });
}

export async function deleteIngredient(id) {
  const db = await getDb();
  return txn(db, async () => {
    const cur = await db.getFirstAsync('SELECT name FROM ingredients WHERE id = ?', [Number(id)]);
    if (!cur) throw new UserError('That ingredient no longer exists.');
    await db.runAsync('DELETE FROM ingredients WHERE id = ?', [Number(id)]); // links and history are removed with it
    await log(db, 'ingredient_deleted', 'ingredient', id, cur.name);
    return { ok: true };
  });
}

export async function getIngredientHistory(id, limit = 30) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT m.id, m.delta, m.balance_after, m.reason, m.note, m.created_at, o.order_number
       FROM ingredient_movements m LEFT JOIN orders o ON o.id = m.order_id WHERE m.ingredient_id = ? ORDER BY m.id DESC LIMIT ?`,
    [Number(id), limit]
  );
}

// =====================================================================
// Tables
// =====================================================================
export async function listTables() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT t.id, t.section, t.seats, t.status, t.held_by, t.is_enabled, u.full_name AS held_by_name
       FROM restaurant_tables t LEFT JOIN users u ON u.id = t.held_by ORDER BY t.id`
  );
  const active = await db.getAllAsync(
    `SELECT o.id, o.order_number, o.table_id, o.status, u.full_name AS customer FROM orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.status IN (${in_(ACTIVE_ORDER_STATUSES)}) ORDER BY o.id`,
    ACTIVE_ORDER_STATUSES
  );
  const today = localISODate(new Date());
  const res = await db.getAllAsync(
    `SELECT id, table_id, guest_name, party_size, res_time, duration_minutes, status FROM reservations
      WHERE res_date = ? AND status IN ('pending', 'confirmed') AND table_id IS NOT NULL ORDER BY res_time`,
    [today]
  );
  const mins = nowMinutes(new Date());
  return rows.map((r) => {
    const orders = active.filter((o) => o.table_id === r.id);
    const reservations = res.filter((x) => x.table_id === r.id);
    const confirmed = reservations.filter((x) => x.status === 'confirmed').map((x) => ({ time: x.res_time, durationMinutes: x.duration_minutes }));
    return {
      id: r.id, section: r.section, seats: r.seats, enabled: r.is_enabled === 1, stored: r.status,
      heldBy: r.held_by_name || null,
      activeOrders: orders,
      reservationsToday: reservations.map((x) => ({ id: x.id, guestName: x.guest_name, partySize: x.party_size, time: x.res_time, durationMinutes: x.duration_minutes, status: x.status })),
      status: tableStatus({ enabled: r.is_enabled === 1, stored: r.status, activeOrders: orders.length, reservedNow: isReservedNow(confirmed, mins) }),
    };
  });
}

// input: { number (new only), section, seats }
export async function saveTable({ number, section, seats, isNew }) {
  const sec = String(section || '').trim();
  if (sec.length < 2 || sec.length > 40) return { ok: false, error: 'Enter a section name, like Main Dining Area.' };
  if (!Number.isInteger(seats) || seats < 1 || seats > 30) return { ok: false, error: 'Seats must be a whole number from 1 to 30.' };
  if (isNew && (!Number.isInteger(number) || number < 1 || number > 999)) return { ok: false, error: 'Table number must be a whole number from 1 to 999.' };
  const db = await getDb();
  return txn(db, async () => {
    if (isNew) {
      const dup = await db.getFirstAsync('SELECT id FROM restaurant_tables WHERE id = ?', [number]);
      if (dup) throw new UserError(`Table ${number} already exists.`);
      await db.runAsync("INSERT INTO restaurant_tables (id, section, seats, status, is_enabled) VALUES (?, ?, ?, 'available', 1)", [number, sec, seats]);
      await log(db, 'table_created', 'table', number, `${sec}, ${seats} seats`);
      return { ok: true, id: number };
    }
    const r = await db.runAsync('UPDATE restaurant_tables SET section = ?, seats = ? WHERE id = ?', [sec, seats, number]);
    if (r.changes !== 1) throw new UserError('That table no longer exists.');
    await log(db, 'table_updated', 'table', number, `${sec}, ${seats} seats`);
    return { ok: true, id: number };
  });
}

export async function setTableEnabled(id, enabled) {
  const db = await getDb();
  return txn(db, async () => {
    const t = await db.getFirstAsync('SELECT id FROM restaurant_tables WHERE id = ?', [Number(id)]);
    if (!t) throw new UserError('That table no longer exists.');
    // Disabling releases a guest who was only holding the table (no order placed yet).
    if (!enabled) await db.runAsync("UPDATE restaurant_tables SET status = 'available', held_by = NULL WHERE id = ? AND status = 'held'", [Number(id)]);
    await db.runAsync('UPDATE restaurant_tables SET is_enabled = ? WHERE id = ?', [enabled ? 1 : 0, Number(id)]);
    await log(db, enabled ? 'table_enabled' : 'table_disabled', 'table', id, null);
    return { ok: true };
  });
}

// occupied = staff marks it in use; available = frees it (blocked while an order is still active)
export async function setTableOccupancy(id, occupied) {
  const db = await getDb();
  return txn(db, async () => {
    const t = await db.getFirstAsync('SELECT id, status FROM restaurant_tables WHERE id = ?', [Number(id)]);
    if (!t) throw new UserError('That table no longer exists.');
    if (!occupied) {
      const n = await db.getFirstAsync(`SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND status IN (${in_(ACTIVE_ORDER_STATUSES)})`, [Number(id), ...ACTIVE_ORDER_STATUSES]);
      if (n.n > 0) throw new UserError('This table still has an active order. Complete or cancel it first.');
      await db.runAsync("UPDATE restaurant_tables SET status = 'available', held_by = NULL WHERE id = ?", [Number(id)]);
    } else {
      if (t.status === 'held') throw new UserError('A guest has already selected this table.');
      await db.runAsync("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?", [Number(id)]);
    }
    await log(db, occupied ? 'table_occupied' : 'table_freed', 'table', id, null);
    return { ok: true };
  });
}

export async function deleteTable(id) {
  const db = await getDb();
  return txn(db, async () => {
    const t = await db.getFirstAsync('SELECT id FROM restaurant_tables WHERE id = ?', [Number(id)]);
    if (!t) throw new UserError('That table no longer exists.');
    const orders = await db.getFirstAsync('SELECT COUNT(*) AS n FROM orders WHERE table_id = ?', [Number(id)]);
    if (orders.n > 0) throw new UserError('This table has order history, so it cannot be deleted. Disable it instead.');
    const res = await db.getFirstAsync("SELECT COUNT(*) AS n FROM reservations WHERE table_id = ? AND status IN ('pending', 'confirmed')", [Number(id)]);
    if (res.n > 0) throw new UserError('This table has upcoming reservations. Cancel or move them first.');
    await db.runAsync('UPDATE reservations SET table_id = NULL WHERE table_id = ?', [Number(id)]);
    await db.runAsync('DELETE FROM restaurant_tables WHERE id = ?', [Number(id)]);
    await log(db, 'table_deleted', 'table', id, null);
    return { ok: true };
  });
}

// =====================================================================
// Reservations
// =====================================================================
const mapRes = (r) => ({
  id: r.id, guestName: r.guest_name, phone: r.phone || '', email: r.email || '', partySize: r.party_size,
  date: r.res_date, time: r.res_time, durationMinutes: r.duration_minutes, tableId: r.table_id, status: r.status, notes: r.notes || '', createdAt: r.created_at,
});

export async function listReservations({ query = '', status = 'all', date = '' } = {}) {
  const db = await getDb();
  const where = [];
  const args = [];
  if (status !== 'all') { where.push('status = ?'); args.push(status); }
  if (date) { where.push('res_date = ?'); args.push(date); }
  if (String(query).trim()) {
    const like = likeOf(query);
    where.push(`(guest_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')`);
    args.push(like, like, like);
  }
  const rows = await db.getAllAsync(`SELECT * FROM reservations ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY res_date DESC, res_time DESC, id DESC LIMIT 500`, args);
  return rows.map(mapRes);
}

async function checkReservation(db, r, { selfId, requireTable }) {
  if (r.tableId == null) {
    if (requireTable) throw new UserError('Assign a table before confirming this reservation.');
    return;
  }
  const t = await db.getFirstAsync('SELECT id, seats, is_enabled FROM restaurant_tables WHERE id = ?', [r.tableId]);
  if (!t) throw new UserError('That table does not exist.');
  if (!t.is_enabled) throw new UserError(`Table ${t.id} is disabled.`);
  if (r.partySize > t.seats) throw new UserError(`Table ${t.id} seats ${t.seats}, but the party is ${r.partySize}.`);
  const others = (await db.getAllAsync("SELECT * FROM reservations WHERE table_id = ? AND res_date = ? AND status IN ('pending', 'confirmed')", [r.tableId, r.date])).map(mapRes);
  const clash = findConflict(others, { ...r, id: selfId });
  if (clash) throw new UserError(`Table ${r.tableId} is already booked ${clash.time} for ${clash.guestName}. Choose another table or time.`);
}

// input: { id?, guestName, phone, email, partySize, date, time, durationMinutes, tableId|null, notes }
export async function saveReservation(input) {
  const today = localISODate(new Date());
  const isNew = !input.id;
  const errors = validateReservation(input, { today, isNew });
  if (Object.keys(errors).length) return { ok: false, error: firstError(errors), errors };
  const db = await getDb();
  const v = [
    String(input.guestName).trim(), String(input.phone || '').trim() || null, String(input.email || '').trim() || null,
    input.partySize, input.date, input.time, input.durationMinutes, input.tableId == null ? null : Number(input.tableId), String(input.notes || '').trim() || null,
  ];
  return txn(db, async () => {
    if (isNew) {
      await checkReservation(db, input, { selfId: 0, requireTable: false });
      const r = await db.runAsync(
        `INSERT INTO reservations (guest_name, phone, email, party_size, res_date, res_time, duration_minutes, table_id, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`, v
      );
      await log(db, 'reservation_created', 'reservation', r.lastInsertRowId, `${v[0]}, ${input.date} ${input.time}`);
      return { ok: true, id: r.lastInsertRowId };
    }
    const cur = await db.getFirstAsync('SELECT status FROM reservations WHERE id = ?', [input.id]);
    if (!cur) throw new UserError('That reservation no longer exists.');
    if (!['pending', 'confirmed'].includes(cur.status)) throw new UserError(`A ${cur.status} reservation cannot be edited.`);
    await checkReservation(db, input, { selfId: input.id, requireTable: cur.status === 'confirmed' });
    await db.runAsync(
      `UPDATE reservations SET guest_name = ?, phone = ?, email = ?, party_size = ?, res_date = ?, res_time = ?, duration_minutes = ?, table_id = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [...v, input.id]
    );
    await log(db, 'reservation_updated', 'reservation', input.id, `${v[0]}, ${input.date} ${input.time}`);
    return { ok: true, id: input.id };
  });
}

export async function setReservationStatus(id, status) {
  const db = await getDb();
  return txn(db, async () => {
    const row = await db.getFirstAsync('SELECT * FROM reservations WHERE id = ?', [Number(id)]);
    if (!row) throw new UserError('That reservation no longer exists.');
    const r = mapRes(row);
    if (!nextReservationStatuses(r.status).includes(status)) throw new UserError(`A ${r.status} reservation cannot be changed to ${status}.`);
    if (status === 'confirmed') await checkReservation(db, r, { selfId: r.id, requireTable: true });
    await db.runAsync("UPDATE reservations SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, r.id]);
    await log(db, `reservation_${status}`, 'reservation', r.id, r.guestName);
    return { ok: true };
  });
}

// =====================================================================
// Customers (read-only)
// =====================================================================
export async function listCustomers() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT u.id, u.full_name, u.email, u.created_at, COUNT(o.id) AS orders,
            COALESCE(SUM(CASE WHEN o.status IN (${in_(REVENUE_STATUSES)}) THEN o.total_cents END), 0) AS spent_cents
       FROM users u LEFT JOIN orders o ON o.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC`,
    REVENUE_STATUSES
  );
}