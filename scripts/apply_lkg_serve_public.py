#!/usr/bin/env python3
"""Serve public catalogue from LKG; refresh D1 every 10s in background; distribute to app."""
from pathlib import Path

snap = Path("lib/siteDataSnapshot.ts")
t = snap.read_text()

old_sync = """  public async syncIfStale(force: boolean = false): Promise<SiteDataSnapshot | null> {
    const now = Date.now();
    const intervalMs = 10000; // 10 seconds refresh interval

    if (!force && (now - this.lastSyncTimestamp < intervalMs)) {
      return this.getLastKnownGood();
    }

    // Trigger refresh in background if stale
    return this.refreshSnapshot({ force });
  }"""

new_sync = """  /**
   * Public-facing path: always return last-known-good immediately (no D1 wait).
   * If older than 10s (or force), kick a background D1 refresh that updates and
   * redistributes the same snapshot file to memory + D1 + R2 + disk.
   */
  public async syncIfStale(force: boolean = false): Promise<SiteDataSnapshot | null> {
    const now = Date.now();
    const intervalMs = 10000; // 10 seconds — LKG refresh cadence

    if (!this.currentSnapshot) {
      await this.loadSnapshot();
    }

    const lkg = this.getLastKnownGood();
    const age = now - this.lastSyncTimestamp;
    const needsRefresh = force || this.lastSyncTimestamp === 0 || age >= intervalMs;

    if (needsRefresh && !this.inFlightRefreshPromise) {
      this.refreshSnapshot({ force: true }).catch((err) => {
        console.warn('[SiteData] background 10s LKG refresh:', err?.message || err);
      });
    }

    return lkg;
  }

  /** Alias for public handlers: serve LKG and schedule 10s refresh. */
  public async servePublicCatalogue(): Promise<SiteDataSnapshot | null> {
    return this.syncIfStale(false);
  }"""

if old_sync in t:
    t = t.replace(old_sync, new_sync)
    print("syncIfStale")
elif "servePublicCatalogue" in t:
    print("sync already")
else:
    print("WARN sync")

old_strip = """        // Secrets + never publish embedded menu blobs (menu_items is the dish source).
        for (const r of restaurants) {
          delete r.password;
          delete r.password_hash;
          delete r.token;
          delete r.secret;
          delete r.categories;
          delete r.menuItems;
          delete r.menu_items;
        }"""

new_strip = """        // Secrets + never publish embedded menu blobs (menu_items is the dish source).
        for (const r of restaurants) {
          delete r.password;
          delete r.password_hash;
          delete r.token;
          delete r.secret;
          delete r.categories;
          delete r.menuItems;
          delete r.menu_items;
        }

        // Attach live menu_items/menu_categories into LKG so public traffic can be served
        // from the distributed snapshot without hammering D1 on every request.
        try {
          const { loadNormalizedMenu } = await import('./restaurantMenu');
          for (const r of restaurants) {
            if (!r?.id) continue;
            try {
              r.categories = await loadNormalizedMenu(String(r.id));
            } catch {
              r.categories = [];
            }
          }
        } catch (menuErr: any) {
          console.warn('[SiteData] LKG menu attach note:', menuErr?.message || menuErr);
        }"""

if old_strip in t:
    t = t.replace(old_strip, new_strip)
    print("menu attach")
elif "loadNormalizedMenu" in t:
    print("menu already")
else:
    print("WARN strip")

snap.write_text(t)

route = Path("app/api/[[...route]]/route.ts")
rt = route.read_text()

old_public = """  // 10b. Public site data: publish the current D1 catalogue, never a saved catalogue snapshot.
  if (pathname === '/site-data/public') {
    try {
      const restaurantsRes = await d1.query(
        'SELECT * FROM restaurants ORDER BY rating DESC',
        [],
        { cache: false }
      );
      if (!restaurantsRes || restaurantsRes.success === false || !Array.isArray(restaurantsRes.results)) {
        throw new Error('Authoritative D1 restaurant query failed');
      }
      const restaurants = await buildPublicRestaurantList(restaurantsRes.results);
      const settingsRes = await d1.query(
        "SELECT key, value FROM platform_settings WHERE key IN ('delivery_zones', 'promo_codes')",
        [],
        { cache: false }
      );
      if (!settingsRes || settingsRes.success === false || !Array.isArray(settingsRes.results)) {
        throw new Error('Authoritative D1 settings query failed');
      }
      const settings: Record<string, any> = {};
      for (const row of settingsRes.results) {
        try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
      }
      return NextResponse.json({
        success: true,
        data: {
          version: Date.now(),
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          source: 'cloudflare_d1',
          syncStatus: 'synced',
          restaurants,
          deliveryZones: Array.isArray(settings.delivery_zones) ? settings.delivery_zones : [],
          promoCodes: Array.isArray(settings.promo_codes) ? settings.promo_codes : [],
          platformSettings: {},
          metadata: { restaurantCount: restaurants.length }
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store'
        }
      });
    } catch (err: any) {
      console.error('[Public site data] Authoritative D1 read failed:', err?.message || err);
      return NextResponse.json({
        success: false,
        error: 'Live catalogue is temporarily unavailable. Please retry.',
        data: null
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }"""

new_public = """  // 10b. Public site data: serve distributed last-known-good (refreshed from D1 every ~10s).
  if (pathname === '/site-data/public') {
    const snapshot = await siteDataManager.servePublicCatalogue();
    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'Catalogue is warming up. Please retry.',
        data: null
      }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      success: true,
      data: {
        version: snapshot.version,
        schemaVersion: snapshot.schemaVersion || 1,
        updatedAt: snapshot.updatedAt,
        source: snapshot.source,
        syncStatus: snapshot.syncStatus || 'synced',
        restaurants: snapshot.restaurants || [],
        deliveryZones: snapshot.deliveryZones || [],
        promoCodes: snapshot.promoCodes || [],
        platformSettings: snapshot.platformSettings || {},
        metadata: snapshot.metadata || { restaurantCount: (snapshot.restaurants || []).length }
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
        'X-Veyrang-Source': 'last-known-good'
      }
    });
  }"""

if old_public in rt:
    rt = rt.replace(old_public, new_public)
    print("public")
elif "servePublicCatalogue" in rt:
    print("public already")
else:
    print("WARN public")

old_rest_start = "  // 11. Public restaurant catalogue: every response is read directly from D1.\n  // A successful empty result is authoritative; never substitute a snapshot or cache.\n  if (pathname === '/restaurants') {"
if old_rest_start in rt:
    idx = rt.find(old_rest_start)
    end = rt.find("  // 12. Single Restaurant", idx)
    if end > 0:
        new_rest = """  // 11. Public restaurant catalogue: served from last-known-good (D1 refresh every 10s).
  if (pathname === '/restaurants') {
    const snapshot = await siteDataManager.servePublicCatalogue();
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Restaurant catalogue is warming up. Please retry.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    let list: any[] = Array.isArray(snapshot.restaurants) ? [...snapshot.restaurants] : [];

    const search = (req.nextUrl.searchParams.get('search') || '').trim().toLowerCase();
    if (search) {
      list = list.filter((restaurant: any) =>
        [restaurant.name, restaurant.cuisine, restaurant.description, ...(Array.isArray(restaurant.tags) ? restaurant.tags : [])]
          .some((value: any) => String(value || '').toLowerCase().includes(search))
      );
    }

    const userAddr = req.nextUrl.searchParams.get('address');
    const userLatStr = req.nextUrl.searchParams.get('lat');
    const userLngStr = req.nextUrl.searchParams.get('lng');
    const uLat = userLatStr ? parseFloat(userLatStr) : NaN;
    const uLng = userLngStr ? parseFloat(userLngStr) : NaN;
    const userLoc = (!isNaN(uLat) && !isNaN(uLng)) ? { lat: uLat, lng: uLng } : (userAddr?.trim() || null);
    if (userLoc && list.length > 0) {
      try {
        list = await calculateBatchRestaurantDistanceMetrics(list, userLoc);
      } catch (err: any) {
        console.warn('[Restaurants] distance metrics note:', err?.message || String(err));
      }
    }

    return NextResponse.json(
      { success: true, data: list, meta: { source: 'last-known-good', version: snapshot.version, updatedAt: snapshot.updatedAt } },
      { headers: { 'Cache-Control': 'public, max-age=5, stale-while-revalidate=10', 'X-Veyrang-Source': 'last-known-good' } }
    );
  }

"""
        rt = rt[:idx] + new_rest + rt[end:]
        print("restaurants")
elif "served from last-known-good" in rt:
    print("restaurants already")
else:
    print("WARN restaurants")

old_single = """  // 12. Single Restaurant
  if (pathname.startsWith('/restaurants/')) {
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

new_single = """  // 12. Single Restaurant — last-known-good first (menus attached at LKG refresh).
  if (pathname.startsWith('/restaurants/')) {
    const parts = pathname.split('/').filter(Boolean);
    const id = parts[1];
    if (id && id !== 'calculate-distance' && parts.length === 2) {
      const snapshot = await siteDataManager.servePublicCatalogue();
      const fromLkg = snapshot?.restaurants?.find((r: any) => String(r?.id) === String(id));
      if (fromLkg) {
        return NextResponse.json(
          { success: true, data: fromLkg },
          { headers: { 'Cache-Control': 'public, max-age=5, stale-while-revalidate=10', 'X-Veyrang-Source': 'last-known-good' } }
        );
      }
      try {
        const d1Res = await d1.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id], { cache: false });
        if (d1Res?.results?.[0]) {
          const data = await buildPublicRestaurant(d1Res.results[0], { includeMenu: true });
          siteDataManager.refreshSnapshot({ force: true }).catch(() => {});
          return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store', 'X-Veyrang-Source': 'd1-miss' } });
        }
        if (d1Res && d1Res.success !== false) {
          return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
        }
      } catch (err) {
        console.warn('[Single Restaurant] D1 miss-path:', err);
      }
      return NextResponse.json(
        { success: false, error: 'Restaurant data temporarily unavailable. Please retry.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }"""

if old_single in rt:
    rt = rt.replace(old_single, new_single)
    print("single")
elif "fromLkg" in rt:
    print("single already")
else:
    print("WARN single")

route.write_text(rt)
print("DONE")
