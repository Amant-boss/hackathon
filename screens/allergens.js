// allergens.js — the 14 major allergens + dietary labels (structured data, never free text)

export const ALLERGENS = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'crustaceans', label: 'Crustaceans' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'fish', label: 'Fish' },
  { key: 'peanuts', label: 'Peanuts' },
  { key: 'soybeans', label: 'Soybeans' },
  { key: 'milk', label: 'Milk' },
  { key: 'tree_nuts', label: 'Tree nuts' },
  { key: 'celery', label: 'Celery' },
  { key: 'mustard', label: 'Mustard' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'sulphites', label: 'Sulphites' },
  { key: 'lupin', label: 'Lupin' },
  { key: 'molluscs', label: 'Molluscs' },
];

export const DIETARY = [
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'gluten_free', label: 'Gluten-free' },
  { key: 'dairy_free', label: 'Dairy-free' },
  { key: 'spicy', label: 'Spicy' },
  { key: 'contains_nuts', label: 'Contains nuts' },
];

const ALLERGEN_LABEL = Object.fromEntries(ALLERGENS.map((a) => [a.key, a.label]));
const DIETARY_LABEL = Object.fromEntries(DIETARY.map((d) => [d.key, d.label]));

export const allergenLabel = (key) => ALLERGEN_LABEL[key] || key;
export const dietaryLabel = (key) => DIETARY_LABEL[key] || key;

// allergenInfo is either null (UNKNOWN: nothing was provided, never treated as "allergen-free")
// or { verified: boolean, contains: string[], mayContain: string[] }.
export function describeAllergens(info) {
  if (!info) return { state: 'unknown', verified: false, contains: [], mayContain: [] };
  return {
    state: 'listed',
    verified: !!info.verified,
    contains: (info.contains || []).map(allergenLabel),
    mayContain: (info.mayContain || []).map(allergenLabel),
  };
}

// Short text for the dish card.
export function allergenSummary(info) {
  const d = describeAllergens(info);
  if (d.state === 'unknown') return 'Allergens: please ask our staff';
  const parts = [];
  parts.push(d.contains.length ? `Contains: ${d.contains.join(', ')}` : 'No allergens listed');
  if (d.mayContain.length) parts.push(`May contain: ${d.mayContain.join(', ')}`);
  return parts.join('. ');
}