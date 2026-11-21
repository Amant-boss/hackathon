// cartLogic.js — pure cart rules (no React). Money is always integer cents.
// These totals are for DISPLAY only: the backend must recalculate prices and
// check availability again when an order is placed.

export const SERVICE_CHARGE_PERCENT = 0; // set e.g. 10 to show a 10% service charge
export const MAX_QTY = 20;
export const initialCart = { lines: [] };

export const formatPrice = (cents) => `€${(Math.round(cents) / 100).toFixed(2)}`;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const cleanNote = (t) => String(t || '').trim().replace(/\s+/g, ' ').slice(0, 140);

// Same dish + same customization => same line. Different customization => separate line.
export const lineKey = (productId, instructions = '', options = []) =>
  `${productId}|${[...options].map(String).sort().join(',')}|${cleanNote(instructions).toLowerCase()}`;

export function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const p = action.product;
      if (!p || !p.available || !Number.isInteger(p.priceCents) || p.priceCents < 0) return state;
      const qty = clamp(Math.floor(action.quantity || 1), 1, MAX_QTY);
      const note = cleanNote(action.instructions);
      const options = action.options || [];
      const key = lineKey(p.id, note, options);
      const i = state.lines.findIndex((l) => l.key === key);
      if (i >= 0) {
        const lines = state.lines.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + qty) } : l));
        return { ...state, lines };
      }
      return {
        ...state,
        lines: [
          ...state.lines,
          { key, productId: p.id, name: p.name, imageUrl: p.imageUrl || null, unitCents: p.priceCents, quantity: qty, instructions: note, options },
        ],
      };
    }
    case 'setQty': {
      const quantity = Math.floor(action.quantity);
      if (!(quantity >= 1)) return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
      return { ...state, lines: state.lines.map((l) => (l.key === action.key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)) };
    }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case 'clear':
      return initialCart;
    default:
      return state;
  }
}

export function cartTotals(lines) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  const serviceCents = Math.round((subtotalCents * SERVICE_CHARGE_PERCENT) / 100);
  return {
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalCents,
    serviceCents,
    totalCents: subtotalCents + serviceCents,
  };
}