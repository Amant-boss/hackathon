// menuService.js — the ONE place the app reads menu data from.
// Today it reads the local SQLite database (db.js). When the FastAPI backend exists,
// replace the body with fetch(`${API_URL}/api/categories`) + fetch(`${API_URL}/api/products`)
// and return the same { categories, products } shape. Screens don't need to change.
import { getMenu } from './db';

export async function fetchMenu() {
  return getMenu();
}