#!/usr/bin/env python3
"""Require auth on admin menu GETs; harden menu source; gitignore local JSON caches."""
from pathlib import Path

route = Path("app/api/[[...route]]/route.ts")
text = route.read_text()
changed = False

old = """  // 24. Admin Categories
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC');
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 25. Admin Menu
  if (pathname === '/admin/menu') {
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC LIMIT 200');
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 26. Admin Addons
  if (pathname === '/admin/addons') {
    const d1Res = await d1.query('SELECT * FROM addons ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""

new = """  // 24. Admin Categories — normalized menu_categories only (auth required)
  if (pathname === '/admin/categories') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 25. Admin Menu — normalized menu_items only (auth required, never mock/JSON embed)
  if (pathname === '/admin/menu') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC LIMIT 500', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 26. Admin Addons — auth required
  if (pathname === '/admin/addons') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT * FROM addons ORDER BY created_at DESC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""

if old in text:
    text = text.replace(old, new)
    changed = True
    print("admin menu auth ok")
elif "Admin Menu — normalized menu_items" in text:
    print("admin menu already hardened")
else:
    print("WARN admin menu pattern missing")

if changed:
    route.write_text(text)
    print("route written", len(text))

gi = Path(".gitignore")
gi_text = gi.read_text() if gi.exists() else ""
extra = """
# Local / generated data — never commit mock or snapshot JSON as source of truth
data/
**/last-known-good-site-data.json
**/veyrang_db.json
src/data/mockData.ts
**/mockData.ts
**/INITIAL_RESTAURANTS*
"""
if "last-known-good-site-data.json" not in gi_text:
    gi.write_text(gi_text.rstrip() + "\n" + extra)
    print("gitignore updated")
else:
    print("gitignore ok")

for path in [
    "src/data/mockData.ts",
    "data/last-known-good-site-data.json",
    ".data/veyrang_db.json",
    "data/veyrang_db.json",
]:
    p = Path(path)
    if p.exists():
        p.unlink()
        print("deleted", path)

print("done")
