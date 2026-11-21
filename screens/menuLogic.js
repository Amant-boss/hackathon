// menuLogic.js — pure search / filter rules (no React)

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// With a search query: searches ALL dishes by name, ingredient and category (every word must match).
// Without one: filters by the selected category ('all' shows everything).
export function filterProducts(products, categories, { categoryId = 'all', query = '' } = {}) {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return categoryId === 'all' ? products : products.filter((p) => p.categoryId === categoryId);
  }
  const catName = new Map(categories.map((c) => [c.id, norm(c.name)]));
  return products.filter((p) => {
    const hay = norm([p.name, catName.get(p.categoryId) || '', ...(p.ingredients || [])].join(' '));
    return terms.every((t) => hay.includes(t));
  });
}