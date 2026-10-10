#!/usr/bin/env python3
"""Wire public restaurant endpoints to normalized menu_items (main branch)."""
from pathlib import Path
import re

route = Path("app/api/[[...route]]/route.ts")
text = route.read_text()
changed = False

if "from '../../../lib/restaurantMenu'" not in text:
    needle = "import { reverseGeocodeCoordinates } from '../../../server/routes/geocode'"
    if needle in text:
        text = text.replace(
            needle,
            needle + "\nimport { buildPublicRestaurant, buildPublicRestaurantList } from '../../../lib/restaurantMenu'",
        )
        changed = True
        print("import added")
    else:
        print("WARN: import anchor missing")

old_site = """      const restaurants = restaurantsRes.results.map((row: any) => {
        let parsed: any = {};
        try { parsed = row.raw_json ? JSON.parse(row.raw_json) : {}; } catch { parsed = {}; }
        return {
          ...parsed,
          id: row.id,
          name: row.name || parsed.name,
          cuisine: row.cuisine || parsed.cuisine,
          rating: row.rating ?? parsed.rating,
          isOpen: row.is_open === 1 || row.is_open === true,
          isBusyPaused: row.is_busy_paused === 1 || row.is_busy_paused === true,
          categories: Array.isArray(parsed.categories) ? parsed.categories : []
        };
      });"""
new_site = "      const restaurants = await buildPublicRestaurantList(restaurantsRes.results);"
if "buildPublicRestaurantList(restaurantsRes.results)" not in text:
    if old_site in text:
        text = text.replace(old_site, new_site)
        changed = True
        print("site-data patched")
    else:
        print("WARN: site-data pattern not found")

old_list = """      list = d1Res.results.map((r: any) => {
        try {
          const parsed = r.raw_json ? JSON.parse(r.raw_json) : r;
          return { ...parsed, id: r.id, name: r.name || parsed.name, cuisine: r.cuisine || parsed.cuisine,
            rating: r.rating ?? parsed.rating, isOpen: r.is_open === 1, isBusyPaused: r.is_busy_paused === 1 };
        } catch { return r; }
      });"""
new_list = "      list = await buildPublicRestaurantList(d1Res.results);"
if "buildPublicRestaurantList(d1Res.results)" not in text:
    if old_list in text:
        text = text.replace(old_list, new_list)
        changed = True
        print("list patched")
    else:
        print("WARN: list pattern not found")

if "buildPublicRestaurant(d1Res.results[0]" not in text:
    start = text.find("if (pathname.startsWith('/restaurants/'))")
    end = text.find("\n  // 13.", start) if start >= 0 else -1
    if start >= 0 and end > start:
        new_single = """if (pathname.startsWith('/restaurants/')) {
    const parts = pathname.split('/').filter(Boolean);
    const id = parts[1];
    if (id && id !== 'calculate-distance' && parts.length === 2) {
      let foundInD1 = false;
      try {
        const d1Res = await d1.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id], { cache: false });
        if (d1Res && d1Res.success !== false) {
          foundInD1 = true;
          if (d1Res.results?.[0]) {
            const data = await buildPublicRestaurant(d1Res.results[0], { includeMenu: true });
            return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
          }
        }
      } catch (err) {
        console.warn('[Single Restaurant] Primary query warning:', err);
      }
      if (foundInD1) {
        return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'Restaurant data temporarily unavailable. Please retry.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }"""
        text = text[:start] + new_single + text[end:]
        changed = True
        print("single patched")
    else:
        print("WARN: single block markers missing", start, end)

sync_start = text.find("async function syncMenuItemToRestaurantJson(")
if sync_start >= 0:
    m = re.search(r"\n(?:export )?async function |\nfunction getUser", text[sync_start + 20 :])
    if m and "clearing legacy embedded menus" not in text[sync_start : sync_start + 800]:
        sync_end = sync_start + 20 + m.start()
        new_sync = """async function syncMenuItemToRestaurantJson(
  itemId: string,
  item: any | null,
  targetRestaurantId?: string | null,
  deletedItemName?: string | null
) {
  // Public menus are served from menu_items / menu_categories only.
  // Strip legacy embedded categories from restaurants.raw_json after mutations.
  const restaurantsRes = await d1.query(
    targetRestaurantId
      ? 'SELECT id, raw_json FROM restaurants WHERE id = ?'
      : 'SELECT id, raw_json FROM restaurants',
    targetRestaurantId ? [targetRestaurantId] : [],
    { cache: false }
  );
  if (!restaurantsRes || restaurantsRes.success === false || !Array.isArray(restaurantsRes.results)) {
    throw new Error('Could not read restaurants while clearing legacy embedded menus.');
  }
  for (const row of restaurantsRes.results || []) {
    let restaurantData: any = {};
    try { restaurantData = row.raw_json ? JSON.parse(row.raw_json) : {}; } catch { restaurantData = {}; }
    if (!restaurantData || typeof restaurantData !== 'object') continue;
    if (!('categories' in restaurantData) && !('menuItems' in restaurantData) && !('menu_items' in restaurantData)) continue;
    delete restaurantData.categories;
    delete restaurantData.menuItems;
    delete restaurantData.menu_items;
    const updateRes = await d1.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [JSON.stringify(restaurantData), row.id]);
    if (!updateRes || updateRes.success === false) {
      throw new Error('Could not strip embedded menu from restaurant ' + row.id);
    }
  }
}

"""
        text = text[:sync_start] + new_sync + text[sync_end:]
        changed = True
        print("sync patched")
    else:
        print("sync already stripped or end not found")

if changed:
    route.write_text(text)
    print("WROTE route", len(text))
else:
    print("No changes")
