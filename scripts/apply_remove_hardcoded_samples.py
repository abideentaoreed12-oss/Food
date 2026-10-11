#!/usr/bin/env python3
"""Remove product hardcoded samples; popular zones from D1; fees from platform_settings only."""
from pathlib import Path
import re

p = Path('src/context/DeliveryContext.tsx')
t = p.read_text()
t2 = re.sub(
    r"const \[platformSettings, setPlatformSettings\] = useState<Record<string, string>>\(\{[\s\S]*?\}\);",
    "const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});",
    t,
    count=1,
)
t2 = t2.replace(
    "Number(platformSettings.base_service_fee_usd || 1.99)",
    "Number(platformSettings.base_service_fee_usd || 0)",
)
t2 = t2.replace(
    "Number(platformSettings.base_service_fee_ngn || 500)",
    "Number(platformSettings.base_service_fee_ngn || 0)",
)
if t2 != t:
    p.write_text(t2)
    print('DeliveryContext')

p = Path('src/components/customer/RestaurantDetailModal.tsx')
if p.exists():
    t = p.read_text()
    t2 = t.replace(
        "selectedAddress?.address || user?.address || 'Lekki Phase 1, Lagos'",
        "selectedAddress?.address || user?.address || ''",
    )
    if t2 != t:
        p.write_text(t2)
        print('RestaurantDetailModal')

p = Path('src/components/landing/LandingPage.tsx')
t = p.read_text()
for a, b in [
    ("|| 'Smoky Party Jollof & Asun'", "|| ''"),
    ("|| 'Smoky Party Jollof & Peppered Asun'", "|| ''"),
    ("|| 'Naija Kitchen'", "|| ''"),
    ("|| 'Double Smash Beef Cheeseburger'", "|| ''"),
    ("|| 'Burger House'", "|| ''"),
    ("|| 'Peppered Beef Suya & Onions'", "|| ''"),
    ("|| 'Suya Express'", "|| ''"),
    ("platformSettings['cms_hero_dish1_image'] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=240&q=80'", "platformSettings['cms_hero_dish1_image'] || ''"),
    ("platformSettings['cms_hero_dish2_image'] || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=240&q=80'", "platformSettings['cms_hero_dish2_image'] || ''"),
    ("platformSettings['cms_hero_dish3_image'] || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=240&q=80'", "platformSettings['cms_hero_dish3_image'] || ''"),
    ("Number(platformSettings['cms_hero_dish1_price'] || 3800)", "Number(platformSettings['cms_hero_dish1_price'] || 0)"),
    ("Number(platformSettings['cms_hero_dish2_price'] || 4200)", "Number(platformSettings['cms_hero_dish2_price'] || 0)"),
    ("Number(platformSettings['cms_hero_dish3_price'] || 2800)", "Number(platformSettings['cms_hero_dish3_price'] || 0)"),
]:
    t = t.replace(a, b)
p.write_text(t)
print('LandingPage')

p = Path('src/components/common/AddressAutocompleteInput.tsx')
t = p.read_text()
t = re.sub(
    r"const POPULAR_ZONES: SuggestionItem\[\] = \[[\s\S]*?\];",
    "const POPULAR_ZONES_UNUSED: SuggestionItem[] = [];",
    t,
    count=1,
)
if 'popularZones' not in t:
    old = "  const [selectedIndex, setSelectedIndex] = useState<number>(-1);\n\n  const containerRef"
    new = """  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [popularZones, setPopularZones] = useState<SuggestionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/delivery-zones', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const rows = Array.isArray(json?.data) ? json.data : [];
        if (cancelled || !rows.length) return;
        setPopularZones(rows.filter((z: any) => z && (z.name || z.code)).slice(0, 12).map((z: any, idx: number) => ({
          id: String(z.id || `zone-${idx}`),
          mainText: String(z.name || z.code || 'Delivery zone'),
          secondaryText: z.code ? String(z.code) : 'Service area',
          fullText: String(z.name || z.code || ''),
          source: 'popular' as const,
          lat: Number.isFinite(Number(z.center_lat ?? z.lat)) ? Number(z.center_lat ?? z.lat) : undefined,
          lng: Number.isFinite(Number(z.center_lng ?? z.lng)) ? Number(z.center_lng ?? z.lng) : undefined,
        })));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const containerRef"""
    if old in t:
        t = t.replace(old, new, 1)
        print('popularZones injected')
t = t.replace('POPULAR_ZONES', 'popularZones')
p.write_text(t)
print('AddressAutocompleteInput')

route = Path('app/api/[[...route]]/route.ts')
rt = route.read_text()
if "pathname === '/delivery-zones'" not in rt:
    anchor = "  // 9. Public delivery zones use the shared snapshot; admin management reads stay separate.\n  if (pathname === '/settings/zones') {"
    insert = """  // Public delivery zones from live D1 (admin-managed \u2014 no hardcoded sample streets).
  if (pathname === '/delivery-zones' || pathname === '/settings/zones') {
    try {
      const d1Res = await d1.query(
        'SELECT * FROM delivery_zones WHERE is_active = 1 OR is_active IS NULL ORDER BY name ASC',
        [],
        { cache: false }
      );
      if (d1Res && d1Res.success !== false && Array.isArray(d1Res.results)) {
        return NextResponse.json({ success: true, data: d1Res.results }, { headers: { 'Cache-Control': 'no-store' } });
      }
    } catch (err: any) {
      console.warn('[delivery-zones] D1 read failed:', err?.message || err);
    }
    let snapshot = await siteDataManager.loadSnapshot();
    if (!snapshot) snapshot = await siteDataManager.refreshSnapshot({ force: true });
    return NextResponse.json({ success: true, data: snapshot?.deliveryZones || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (false && pathname === '/settings/zones') {
"""
    if anchor in rt:
        rt = rt.replace(anchor, insert, 1)
        dead = """  if (false && pathname === '/settings/zones') {

    let snapshot = await siteDataManager.loadSnapshot();
    if (!snapshot) snapshot = await siteDataManager.refreshSnapshot({ force: true });
    else siteDataManager.syncIfStale().catch(() => {});
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Live delivery-zone data is temporarily unavailable.', data: null },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json({ success: true, data: snapshot.deliveryZones || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

"""
        rt = rt.replace(dead, '')
        route.write_text(rt)
        print('route delivery-zones')
    else:
        print('WARN route anchor missing')
else:
    print('route already has delivery-zones')

print('DONE')
