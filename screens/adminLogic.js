// adminLogic.js — pure rules for the admin dashboard (no React, no database).
import { ALLERGENS, DIETARY } from './allergens';

export const UNITS = ['g', 'kg', 'ml', 'l', 'pcs'];

// ---------- orders ----------
export const ORDER_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];
export const REVENUE_STATUSES = ['confirmed', 'preparing', 'ready', 'served', 'completed']; // accepted orders only
export const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served'];
export const HOLD_STATUSES = new Set(['confirmed', 'preparing', 'ready', 'served', 'completed']); // ingredients are used

const NEXT = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};
export const nextStatuses = (status) => NEXT[status] || [];

// ---------- numbers ----------
export const round3 = (n) => Math.round(n * 1000) / 1000;

export function parseDecimal(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const t = String(input == null ? '' : input).trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// "14.90" or "14,9" -> 1490 ; invalid, zero or too large -> null
export function parseMoneyToCents(input) {
  const t = String(input == null ? '' : input).trim().replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 ? cents : null;
}

// quantities: 0 or more, at most 3 decimals kept
export function parseQuantity(input) {
  const n = parseDecimal(input);
  return Number.isFinite(n) && n >= 0 && n <= 1000000 ? round3(n) : null;
}

export function stockStatus(quantity, minStock) {
  if (quantity <= 0) return 'out';
  if (quantity <= minStock) return 'low';
  return 'ok';
}

// ---------- dates and times (local, ISO-like) ----------
const p2 = (n) => String(n).padStart(2, '0');
export const localISODate = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const nowMinutes = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISODate(new Date(y, m - 1, d + n));
}
export function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
}
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
export const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ---------- reservations ----------
export const RES_ACTIVE = ['pending', 'confirmed']; // these block a table
const RES_NEXT = { pending: ['confirmed', 'rejected', 'cancelled'], confirmed: ['cancelled', 'completed'], rejected: [], cancelled: [], completed: [] };
export const nextReservationStatuses = (s) => RES_NEXT[s] || [];

export const overlaps = (aStart, aDur, bStart, bDur) => aStart < bStart + bDur && bStart < aStart + aDur;

export function findConflict(existing, cand) {
  return (
    existing.find(
      (r) =>
        r.id !== cand.id &&
        RES_ACTIVE.includes(r.status) &&
        r.tableId === cand.tableId &&
        r.date === cand.date &&
        overlaps(toMinutes(r.time), r.durationMinutes, toMinutes(cand.time), cand.durationMinutes)
    ) || null
  );
}

// reservations: confirmed ones for ONE table on today's date
export function isReservedNow(reservations, minutes, lead = 30) {
  return reservations.some((r) => {
    const start = toMinutes(r.time);
    return minutes >= start - lead && minutes < start + r.durationMinutes;
  });
}

// ---------- tables ----------
export function tableStatus({ enabled, stored, activeOrders, reservedNow }) {
  if (!enabled) return 'unavailable';
  if (stored === 'occupied' || stored === 'held' || activeOrders > 0) return 'occupied';
  if (reservedNow) return 'reserved';
  return 'available';
}

// ---------- validation (used by the UI and again by the database layer) ----------
const ALLERGEN_KEYS = new Set(ALLERGENS.map((a) => a.key));
const DIETARY_KEYS = new Set(DIETARY.map((d) => d.key));

export function validateFood(f) {
  const e = {};
  const name = String(f.name || '').trim();
  if (name.length < 2 || name.length > 80) e.name = 'Enter a name (2 to 80 characters).';
  const desc = String(f.description || '').trim();
  if (desc.length < 5 || desc.length > 300) e.description = 'Enter a description (5 to 300 characters).';
  if (!Number.isInteger(f.priceCents) || f.priceCents < 1 || f.priceCents > 999999) e.price = 'Enter a price greater than 0, like 12.50.';
  if (!Number.isInteger(f.categoryId)) e.category = 'Choose a category.';
  if (!Number.isInteger(f.prepMinutes) || f.prepMinutes < 1 || f.prepMinutes > 240) e.prep = 'Preparation time must be 1 to 240 minutes.';
  const img = String(f.imageUrl || '').trim();
  if (img && (!/^https?:\/\/\S+$/i.test(img) || img.length > 500)) e.image = 'Use a full image link starting with http:// or https://';

  const info = f.allergenInfo;
  const contains = info ? info.contains || [] : [];
  const may = info ? info.mayContain || [] : [];
  if (info && ![...contains, ...may].every((k) => ALLERGEN_KEYS.has(k))) e.allergens = 'Unknown allergen.';
  const diet = f.dietary || [];
  if (!diet.every((k) => DIETARY_KEYS.has(k))) e.dietary = 'Unknown dietary label.';
  else if (info) {
    if (diet.includes('gluten_free') && contains.includes('gluten')) e.dietary = 'A dish that contains gluten cannot be labelled gluten-free.';
    else if (diet.includes('dairy_free') && contains.includes('milk')) e.dietary = 'A dish that contains milk cannot be labelled dairy-free.';
    else if (diet.includes('vegan') && contains.some((k) => ['milk', 'eggs', 'fish', 'crustaceans', 'molluscs'].includes(k))) e.dietary = 'A dish with milk, eggs, fish, crustaceans or molluscs cannot be labelled vegan.';
    else if (diet.includes('vegetarian') && contains.some((k) => ['fish', 'crustaceans', 'molluscs'].includes(k))) e.dietary = 'A dish containing fish or shellfish cannot be labelled vegetarian.';
  }
  const seen = new Set();
  for (const r of f.recipe || []) {
    if (!Number.isInteger(r.ingredientId) || !(r.amount > 0) || r.amount > 1000000) { e.recipe = 'Each ingredient needs an amount greater than 0.'; break; }
    if (seen.has(r.ingredientId)) { e.recipe = 'An ingredient is listed twice.'; break; }
    seen.add(r.ingredientId);
  }
  return e;
}

export function validateIngredient(i) {
  const e = {};
  const name = String(i.name || '').trim();
  if (name.length < 2 || name.length > 60) e.name = 'Enter a name (2 to 60 characters).';
  if (!UNITS.includes(i.unit)) e.unit = 'Choose a unit.';
  if (!(typeof i.quantity === 'number' && i.quantity >= 0 && i.quantity <= 1000000)) e.quantity = 'Enter a quantity of 0 or more.';
  if (!(typeof i.minStock === 'number' && i.minStock >= 0 && i.minStock <= 1000000)) e.minStock = 'Enter a minimum of 0 or more.';
  return e;
}

export function validateReservation(r, { today, isNew }) {
  const e = {};
  const name = String(r.guestName || '').trim();
  if (name.length < 2 || name.length > 80) e.guestName = 'Enter the guest name.';
  const phone = String(r.phone || '').trim();
  if (phone && !/^[+\d][\d\s()-]{5,19}$/.test(phone)) e.phone = 'Enter a valid phone number.';
  const email = String(r.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Enter a valid email.';
  if (!Number.isInteger(r.partySize) || r.partySize < 1 || r.partySize > 50) e.partySize = 'Party size must be 1 to 50.';
  if (!isDate(r.date)) e.date = 'Use the format YYYY-MM-DD.';
  else if (isNew && r.date < today) e.date = 'The date cannot be in the past.';
  if (!isTime(r.time)) e.time = 'Use the 24-hour format HH:MM.';
  if (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 30 || r.durationMinutes > 300) e.duration = 'Duration must be 30 to 300 minutes.';
  if (String(r.notes || '').length > 300) e.notes = 'Notes are too long.';
  return e;
}

export const firstError = (errors) => Object.values(errors)[0] || null;