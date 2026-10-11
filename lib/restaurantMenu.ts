/**
 * Public restaurant menus are served only from normalized D1 tables:
 *   menu_categories + menu_items
 *
 * Embedded categories/items inside restaurants.raw_json are legacy and must not
 * be the public source of truth. On first read, if the normalized tables are empty
 * for a restaurant but raw_json still has a menu, we backfill once, then strip
 * the embedded menu from raw_json so it cannot resurrect deleted dishes.
 */
import { d1 } from './d1';

export type PublicMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  imageUrl?: string;
  isAvailable: boolean;
  dietary: string[];
  popular?: boolean;
  categoryId?: string;
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
  items: PublicMenuItem[];
};

function parseJsonSafe(value: any, fallback: any = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function mapItemRow(row: any): PublicMenuItem {
  const dietary = parseJsonSafe(row.dietary_tags, []);
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: typeof row.description === 'string' ? row.description : '',
    price: Number.isFinite(Number(row.price)) ? Number(row.price) : 0,
    image: typeof row.image_r2_url === 'string' && row.image_r2_url ? row.image_r2_url : undefined,
    imageUrl: typeof row.image_r2_url === 'string' && row.image_r2_url ? row.image_r2_url : undefined,
    isAvailable: row.is_available === 1 || row.is_available === true,
    dietary: Array.isArray(dietary) ? dietary.filter((t: any) => typeof t === 'string') : [],
    popular: row.popular === 1 || row.popular === true,
    categoryId: row.category_id ? String(row.category_id) : undefined,
  };
}

/** Load categories + items for one restaurant from normalized tables only. */
export async function loadNormalizedMenu(restaurantId: string): Promise<PublicMenuCategory[]> {
  const [catsRes, itemsRes] = await Promise.all([
    d1.query(
      'SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order ASC, name ASC',
      [restaurantId],
      { cache: false }
    ),
    d1.query(
      'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY name ASC',
      [restaurantId],
      { cache: false }
    ),
  ]);

  if (!catsRes || catsRes.success === false || !itemsRes || itemsRes.success === false) {
    throw new Error('Normalized menu query failed');
  }

  const items = (itemsRes.results || []).map(mapItemRow);
  const byCategory = new Map<string, PublicMenuItem[]>();
  const uncategorized: PublicMenuItem[] = [];

  for (const item of items) {
    if (item.categoryId) {
      const list = byCategory.get(item.categoryId) || [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    } else {
      uncategorized.push(item);
    }
  }

  const categories: PublicMenuCategory[] = (catsRes.results || []).map((c: any) => ({
    id: String(c.id),
    name: String(c.name || 'Menu'),
    description: typeof c.description === 'string' ? c.description : undefined,
    sortOrder: Number(c.sort_order) || 0,
    items: byCategory.get(String(c.id)) || [],
  }));

  const knownIds = new Set(categories.map((c) => c.id));
  for (const [catId, list] of byCategory) {
    if (!knownIds.has(catId) && list.length) {
      uncategorized.push(...list);
    }
  }

  if (uncategorized.length) {
    categories.push({
      id: `uncat-${restaurantId}`,
      name: 'Menu',
      items: uncategorized,
    });
  }

  return categories.filter((c) => c.items.length > 0);
}

/**
 * If menu_items is empty for this restaurant but raw_json still embeds a menu,
 * copy that menu into menu_categories + menu_items once, then strip embedded
 * categories from raw_json so the document is no longer a second source of truth.
 */
export async function backfillMenuFromEmbeddedIfNeeded(
  restaurantId: string,
  rawJson: any
): Promise<boolean> {
  const countRes = await d1.query(
    'SELECT COUNT(*) as c FROM menu_items WHERE restaurant_id = ?',
    [restaurantId],
    { cache: false }
  );
  if (!countRes || countRes.success === false) {
    throw new Error('Could not count menu_items for backfill');
  }
  const existing = Number(countRes.results?.[0]?.c || 0);
  if (existing > 0) return false;

  const parsed = typeof rawJson === 'string' ? parseJsonSafe(rawJson, {}) : rawJson || {};
  const embedded = Array.isArray(parsed.categories) ? parsed.categories : [];
  const hasItems = embedded.some((c: any) => Array.isArray(c?.items) && c.items.length > 0);
  if (!hasItems) return false;

  const now = new Date().toISOString();
  let sort = 0;

  for (const cat of embedded) {
    if (!cat || typeof cat !== 'object') continue;
    const items = Array.isArray(cat.items) ? cat.items : [];
    if (!items.length && !cat.name) continue;

    const categoryId = String(cat.id || `cat-${restaurantId}-${sort}`);
    const categoryName = String(cat.name || 'Menu').trim() || 'Menu';

    await d1.query(
      `INSERT OR IGNORE INTO menu_categories (id, restaurant_id, name, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [categoryId, restaurantId, categoryName, typeof cat.description === 'string' ? cat.description : null, sort, now]
    );
    sort += 1;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const name = String(item.name || '').trim();
      if (!name) continue;
      const itemId = String(item.id || `item-${restaurantId}-${Math.random().toString(36).slice(2, 10)}`);
      const price = Number(item.price);
      const dietary = Array.isArray(item.dietary)
        ? item.dietary
        : Array.isArray(item.dietary_tags)
          ? item.dietary_tags
          : [];
      const image =
        (typeof item.imageUrl === 'string' && item.imageUrl) ||
        (typeof item.image === 'string' && item.image) ||
        (typeof item.image_r2_url === 'string' && item.image_r2_url) ||
        null;
      const available = item.isAvailable !== false && item.is_available !== 0 && item.is_available !== false;

      await d1.query(
        `INSERT OR IGNORE INTO menu_items
          (id, restaurant_id, category_id, name, description, price, dietary_tags, popular, is_available, image_r2_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          restaurantId,
          categoryId,
          name,
          typeof item.description === 'string' ? item.description : '',
          Number.isFinite(price) ? price : 0,
          JSON.stringify(dietary.filter((t: any) => typeof t === 'string')),
          item.popular === true || item.popular === 1 ? 1 : 0,
          available ? 1 : 0,
          image,
          now,
        ]
      );
    }
  }

  const cleaned = { ...parsed };
  delete cleaned.categories;
  delete cleaned.menuItems;
  delete cleaned.menu_items;
  await d1.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [JSON.stringify(cleaned), restaurantId]);

  console.log(`[Menu] Backfilled normalized menu for ${restaurantId} from legacy embedded JSON and stripped embed`);
  return true;
}

/** Strip secrets and embedded menu fields from a restaurant document. */
export function stripRestaurantDocument(parsed: any, row: any) {
  const base = { ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  delete base.password;
  delete base.password_hash;
  delete base.token;
  delete base.secret;
  delete base.categories;
  delete base.menuItems;
  delete base.menu_items;
  return {
    ...base,
    id: String(row.id || base.id || ''),
    name: row.name || base.name,
    cuisine: row.cuisine || base.cuisine,
    rating: row.rating ?? base.rating,
    reviewCount: row.review_count ?? base.reviewCount,
    deliveryTimeMin: row.delivery_time_min ?? base.deliveryTimeMin,
    deliveryTimeMax: row.delivery_time_max ?? base.deliveryTimeMax,
    deliveryFee: row.delivery_fee ?? base.deliveryFee,
    isOpen: row.is_open === 1 || row.is_open === true || base.isOpen === true,
    isBusyPaused: row.is_busy_paused === 1 || row.is_busy_paused === true || base.isBusyPaused === true,
  };
}

/**
 * Build the public restaurant object: metadata from restaurants row +
 * categories/items strictly from menu_categories / menu_items.
 */
export async function buildPublicRestaurant(row: any, options?: { includeMenu?: boolean }) {
  const includeMenu = options?.includeMenu !== false;
  let parsed: any = {};
  try {
    parsed = row.raw_json ? JSON.parse(row.raw_json) : {};
  } catch {
    parsed = {};
  }

  if (includeMenu) {
    await backfillMenuFromEmbeddedIfNeeded(String(row.id), parsed);
  }

  const publicRest = stripRestaurantDocument(parsed, row);
  if (includeMenu) {
    publicRest.categories = await loadNormalizedMenu(String(row.id));
  } else {
    publicRest.categories = [];
  }
  return publicRest;
}

/** Batch-build public restaurants (list view includes menus so cart rehydrate works). */
export async function buildPublicRestaurantList(rows: any[]) {
  const out = [];
  for (const row of rows) {
    out.push(await buildPublicRestaurant(row, { includeMenu: true }));
  }
  return out;
}
