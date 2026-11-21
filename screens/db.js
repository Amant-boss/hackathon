// db.js — local SQLite storage for Amant's Restaurant (Expo)
//
// Install:
//   npx expo install expo-sqlite expo-crypto
//   npm install @noble/hashes@1
//
// Passwords are NEVER stored in plaintext. Each user gets a random salt and the
// password is run through PBKDF2-SHA256; only the hash + salt are saved.
//
// IMPORTANT: this database lives on the user's own device. It is fine for a
// demo, an offline prototype, or local-only data, but it is NOT a real login
// system: anyone with the device can read or copy the file, and accounts are
// not shared between devices. For real accounts use the PHP/MySQL backend
// (password_hash / password_verify, prepared statements, sessions, CSRF).

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { SEED_CATEGORIES, SEED_PRODUCTS } from './menuData';

const DB_NAME = 'amants_restaurant.db';
const ITERATIONS = 10000; // raise on fast devices; PBKDF2 runs in JS here

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS users (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name     TEXT    NOT NULL,
          email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
          password_hash TEXT    NOT NULL,
          salt          TEXT    NOT NULL,
          iterations    INTEGER NOT NULL,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS restaurant_tables (
          id      INTEGER PRIMARY KEY,
          section TEXT    NOT NULL,
          seats   INTEGER NOT NULL,
          status  TEXT    NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'held')),
          held_by INTEGER REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS categories (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          slug          TEXT    NOT NULL UNIQUE,
          name          TEXT    NOT NULL,
          description   TEXT,
          image_url     TEXT,
          display_order INTEGER NOT NULL DEFAULT 0,
          is_active     INTEGER NOT NULL DEFAULT 1,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS products (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          name          TEXT    NOT NULL,
          description   TEXT    NOT NULL,
          price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
          image_url     TEXT,
          category_id   INTEGER NOT NULL REFERENCES categories(id),
          ingredients   TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
          allergen_info TEXT,                            -- NULL = unknown; else JSON {verified, contains[], mayContain[]}
          dietary_labels TEXT   NOT NULL DEFAULT '[]',   -- JSON array of keys
          prep_minutes  INTEGER NOT NULL DEFAULT 10,
          is_available  INTEGER NOT NULL DEFAULT 1,
          is_featured   INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      `);
      await seedTables(db);
      await seedMenu(db);
      return db;
    })();
  }
  return dbPromise;
}

// DEMO SEED DATA. Tables 03, 07 and 10 are marked occupied only so the screen has
// something to show. This is NOT real-time availability; replace with live data
// (e.g. a MySQL-backed PHP API) before using in a real restaurant.
const SEED_TABLES = [
  [1, 'Window Seating', 2, 'available'],
  [2, 'Window Seating', 2, 'available'],
  [3, 'Window Seating', 4, 'occupied'],
  [4, 'Window Seating', 4, 'available'],
  [5, 'Main Dining Area', 4, 'available'],
  [6, 'Main Dining Area', 4, 'available'],
  [7, 'Main Dining Area', 2, 'occupied'],
  [8, 'Main Dining Area', 4, 'available'],
  [9, 'Main Dining Area', 4, 'available'],
  [10, 'Main Dining Area', 2, 'occupied'],
  [11, 'Private Dining', 6, 'available'],
  [12, 'Private Dining', 6, 'available'],
];

async function seedTables(db) {
  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM restaurant_tables');
  if (row && row.n > 0) return;
  for (const t of SEED_TABLES) {
    await db.runAsync('INSERT INTO restaurant_tables (id, section, seats, status) VALUES (?, ?, ?, ?)', t);
  }
}

// DEMO MENU. Inserted only when the categories table is empty; existing data is never touched.
async function seedMenu(db) {
  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM categories');
  if (row && row.n > 0) return;
  let order = 1;
  for (const [slug, name, description] of SEED_CATEGORIES) {
    await db.runAsync('INSERT INTO categories (slug, name, description, display_order) VALUES (?, ?, ?, ?)', [slug, name, description, order++]);
  }
  for (const d of SEED_PRODUCTS) {
    await db.runAsync(
      `INSERT INTO products (name, description, price_cents, image_url, category_id, ingredients, allergen_info, dietary_labels, prep_minutes, is_available, is_featured)
       VALUES (?, ?, ?, ?, (SELECT id FROM categories WHERE slug = ?), ?, ?, ?, ?, ?, ?)`,
      [d.name, d.description, d.cents, d.image, d.cat, JSON.stringify(d.ingredients), d.allergenInfo ? JSON.stringify(d.allergenInfo) : null, JSON.stringify(d.dietary), d.prep, d.available ? 1 : 0, d.featured ? 1 : 0]
    );
  }
}

async function hashPassword(password, saltHex, iterations) {
  const key = await pbkdf2Async(sha256, password, saltHex, { c: iterations, dkLen: 32 });
  return bytesToHex(key);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

// -> { ok: true, user } | { ok: false, error }
export async function registerUser({ name, email, password }) {
  const fullName = String(name || '').trim();
  const mail = normEmail(email);
  if (!fullName || !mail || String(password || '').length < 8) {
    return { ok: false, error: 'Please check your details and try again.' };
  }
  try {
    const db = await getDb();
    const salt = bytesToHex(Crypto.getRandomBytes(16));
    const hash = await hashPassword(password, salt, ITERATIONS);
    const res = await db.runAsync(
      'INSERT INTO users (full_name, email, password_hash, salt, iterations) VALUES (?, ?, ?, ?, ?)',
      [fullName, mail, hash, salt, ITERATIONS]
    );
    return { ok: true, user: { id: res.lastInsertRowId, fullName, email: mail } };
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return { ok: false, error: 'An account with this email already exists. Try logging in.' };
    }
    return { ok: false, error: 'We could not save your account. Please try again.' };
  }
}

// -> { ok: true, user } | { ok: false, error }
export async function loginUser({ email, password }) {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync(
      'SELECT id, full_name, email, password_hash, salt, iterations FROM users WHERE email = ?',
      [normEmail(email)]
    );
    // Same message for "no such user" and "wrong password".
    const bad = { ok: false, error: 'Email or password is incorrect.' };
    if (!row) return bad;
    const hash = await hashPassword(password, row.salt, row.iterations);
    if (!safeEqual(hash, row.password_hash)) return bad;
    return { ok: true, user: { id: row.id, fullName: row.full_name, email: row.email } };
  } catch (e) {
    return { ok: false, error: 'We could not read the database. Please try again.' };
  }
}

export async function countUsers() {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT COUNT(*) AS n FROM users');
  return row ? row.n : 0;
}


// ---------- table selection ----------
// All rules live here (not in the UI): unknown ids are rejected, occupied or
// held-by-someone-else tables cannot be taken, and a guest holds at most one table.

const padNum = (n) => String(n).padStart(2, '0');

// state: 'available' | 'selected' (held by this user) | 'occupied' (occupied or held by another guest)
export async function getTables(userId) {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT id, section, seats, status, held_by FROM restaurant_tables ORDER BY id');
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    seats: r.seats,
    state: r.status === 'available' ? 'available' : r.status === 'held' && r.held_by === userId ? 'selected' : 'occupied',
  }));
}

export async function selectTable(userId, tableId) {
  const id = Number(tableId);
  if (!Number.isInteger(id) || !Number.isInteger(userId)) {
    return { ok: false, error: 'That table does not exist.' };
  }
  try {
    const db = await getDb();
    let result = { ok: false, error: 'We could not select that table. Please try again.' };
    await db.withTransactionAsync(async () => {
      const t = await db.getFirstAsync('SELECT id, status, held_by FROM restaurant_tables WHERE id = ?', [id]);
      if (!t) { result = { ok: false, error: 'That table does not exist.' }; return; }
      if (t.status === 'held' && t.held_by === userId) { result = { ok: true, tableId: id }; return; }
      if (t.status !== 'available') {
        result = { ok: false, error: `Table ${padNum(id)} is not available. Please choose another table.` };
        return;
      }
      await db.runAsync("UPDATE restaurant_tables SET status = 'available', held_by = NULL WHERE held_by = ? AND status = 'held'", [userId]);
      const r = await db.runAsync("UPDATE restaurant_tables SET status = 'held', held_by = ? WHERE id = ? AND status = 'available'", [userId, id]);
      result = r.changes === 1
        ? { ok: true, tableId: id }
        : { ok: false, error: `Table ${padNum(id)} was just taken. Please choose another table.` };
    });
    return result;
  } catch (e) {
    return { ok: false, error: 'We could not select that table. Please try again.' };
  }
}

// Re-checks that the table is still held by this guest before continuing to the menu.
export async function confirmTable(userId, tableId) {
  try {
    const db = await getDb();
    const t = await db.getFirstAsync(
      "SELECT id, section, seats FROM restaurant_tables WHERE id = ? AND status = 'held' AND held_by = ?",
      [Number(tableId), userId]
    );
    if (!t) return { ok: false, error: 'Your table is no longer held. Please choose a table again.' };
    return { ok: true, table: { id: t.id, section: t.section, seats: t.seats } };
  } catch (e) {
    return { ok: false, error: 'We could not confirm your table. Please try again.' };
  }
}

// Called on log out so the table goes back to the floor plan.
export async function releaseTable(userId) {
  try {
    const db = await getDb();
    await db.runAsync("UPDATE restaurant_tables SET status = 'available', held_by = NULL WHERE held_by = ? AND status = 'held'", [userId]);
  } catch (e) { /* nothing to release */ }
}


// ---------- menu (read-only for customers) ----------
function safeJson(text, fallback) {
  try { const v = JSON.parse(text); return v === undefined ? fallback : v; } catch (e) { return fallback; }
}

export async function getMenu() {
  const db = await getDb();
  const categories = await db.getAllAsync(
    'SELECT id, slug, name, description, image_url, display_order FROM categories WHERE is_active = 1 ORDER BY display_order, id'
  );
  const rows = await db.getAllAsync(
    `SELECT p.id, p.name, p.description, p.price_cents, p.image_url, p.category_id, p.ingredients, p.allergen_info,
            p.dietary_labels, p.prep_minutes, p.is_available, p.is_featured
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE c.is_active = 1
      ORDER BY c.display_order, p.id`
  );
  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description })),
    products: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      priceCents: r.price_cents,
      imageUrl: r.image_url,
      categoryId: r.category_id,
      ingredients: safeJson(r.ingredients, []),
      allergenInfo: r.allergen_info == null ? null : safeJson(r.allergen_info, null),
      dietary: safeJson(r.dietary_labels, []),
      prepMinutes: r.prep_minutes,
      available: r.is_available === 1,
      featured: r.is_featured === 1,
    })),
  };
}