#!/usr/bin/env python3
from pathlib import Path

route = Path('app/api/[[...route]]/route.ts')
t = route.read_text()

old = """  // 24. Admin Categories \u2014 normalized menu_categories only (auth required)
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""
# try both dash characters
for old in [
"""  // 24. Admin Categories \u2014 normalized menu_categories only (auth required)
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }""",
"""  // 24. Admin Categories \u2014 normalized menu_categories only (auth required)
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }""",
]:
    pass

old_a = (
    "  // 24. Admin Categories \u2014 normalized menu_categories only (auth required)\n"
    "  if (pathname === '/admin/categories') {\n"
    "    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });\n"
    "    return NextResponse.json({ success: true, data: d1Res.results || [] });\n"
    "  }"
)
# Use ASCII hyphen version found on main
old_b = """  // 24. Admin Categories \u2014 normalized menu_categories only (auth required)
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""

new_cat = """  // 24. Categories \u2014 D1 only; admin all, restaurant own kitchen
  if (pathname === '/admin/categories') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role === 'restaurant') {
      const rid = user.restaurantId || (await d1.query('SELECT restaurant_id FROM users WHERE id = ? LIMIT 1', [user.id])).results?.[0]?.restaurant_id;
      if (!rid) return NextResponse.json({ success: true, data: [] });
      const d1Res = await d1.query('SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY sort_order ASC', [rid], { cache: false });
      return NextResponse.json({ success: true, data: d1Res.results || [] });
    }
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""

# Match whatever em-dash or hyphen is in file
import re
m = re.search(r"  // 24\. Admin Categories .{1,3} normalized menu_categories only \(auth required\)\n  if \(pathname === '/admin/categories'\) \{\n    const d1Res = await d1\.query\('SELECT \* FROM menu_categories ORDER BY sort_order ASC', \[\], \{ cache: false \}\);\n    return NextResponse\.json\(\{ success: true, data: d1Res\.results \|\| \[\] \}\);\n  \}", t)
if m:
    t = t[:m.start()] + new_cat + t[m.end():]
    print('categories')
else:
    print('categories skip')

m = re.search(r"  // 26\. Admin Addons .{1,20}\n  if \(pathname === '/admin/addons'\) \{\n    const d1Res = await d1\.query\('SELECT \* FROM addons ORDER BY created_at DESC', \[\], \{ cache: false \}\);\n    return NextResponse\.json\(\{ success: true, data: d1Res\.results \|\| \[\] \}\);\n  \}", t)
new_add = """  // 26. Addons \u2014 auth required (admin / sub_admin / restaurant)
  if (pathname === '/admin/addons') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT * FROM addons ORDER BY created_at DESC', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""
if m:
    t = t[:m.start()] + new_add + t[m.end():]
    print('addons')
else:
    print('addons skip')

# DELETE gate
if "Administrator access required" in t and "export async function DELETE" in t:
    t2 = re.sub(
        r"(export async function DELETE\(req: NextRequest\) \{\n  const pathname = req\.nextUrl\.pathname\.replace\(/\^\\/api/, ''\) \|\| '/';\n)  if \(pathname\.startsWith\('/admin/'\)\) \{\n    const user = await getUser\(req\);\n    if \(!user \|\| \(user\.role !== 'admin' && user\.role !== 'sub_admin'\)\) \{\n      return NextResponse\.json\(\{ success: false, error: 'Administrator access required' \}, \{ status: 401 \}\);\n    \}\n  \}\n  const user = await getUser\(req\);",
        r"""\1  const user = await getUser(req);
  if (pathname.startsWith('/admin/')) {
    const menuPath = pathname.startsWith('/admin/menu') || pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/addons');
    const allowed =
      user &&
      (user.role === 'admin' ||
        user.role === 'sub_admin' ||
        (user.role === 'restaurant' && menuPath));
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
  }""",
        t,
        count=1,
    )
    if t2 != t:
        t = t2
        print('DELETE')
    else:
        print('DELETE skip')

route.write_text(t)
print('route', len(t))

# Portal form
p = Path('src/components/restaurant/RestaurantPortal.tsx')
pt = p.read_text()
if 'loadLiveMenu' not in pt:
    pt = pt.replace("import React, { useState } from 'react';", "import React, { useState, useEffect, useCallback } from 'react';")
    if "from '../../services/api'" not in pt:
        pt = pt.replace(
            "import { SpecialActionButton } from '../shared/SpecialActionButton';",
            "import { SpecialActionButton } from '../shared/SpecialActionButton';\nimport { api } from '../../services/api';",
        )
    pt = pt.replace(
        "  const [activeTab, setActiveTab] = useState<'tickets' | 'menu' | 'finance'>('tickets');\n  const [ticketPrinted, setTicketPrinted] = useState<string | null>(null);",
        "  const [activeTab, setActiveTab] = useState<'tickets' | 'menu' | 'finance'>('tickets');\n  const [ticketPrinted, setTicketPrinted] = useState<string | null>(null);\n  const [liveMenu, setLiveMenu] = useState<any[]>([]);\n  const [menuLoading, setMenuLoading] = useState(false);\n  const [menuMsg, setMenuMsg] = useState('');\n  const [newDishName, setNewDishName] = useState('');\n  const [newDishPrice, setNewDishPrice] = useState('');\n  const [newDishDesc, setNewDishDesc] = useState('');\n  const [savingDish, setSavingDish] = useState(false);",
    )
    # real newlines version
    if 'liveMenu' not in pt:
        pt = pt.replace(
            """  const [activeTab, setActiveTab] = useState<'tickets' | 'menu' | 'finance'>('tickets');
  const [ticketPrinted, setTicketPrinted] = useState<string | null>(null);""",
            """  const [activeTab, setActiveTab] = useState<'tickets' | 'menu' | 'finance'>('tickets');
  const [ticketPrinted, setTicketPrinted] = useState<string | null>(null);
  const [liveMenu, setLiveMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuMsg, setMenuMsg] = useState('');
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [savingDish, setSavingDish] = useState(false);""",
        )
    marker = """  const restaurantOrders = currentRestaurant
    ? orders.filter((o) => o.restaurantId === currentRestaurant.id)
    : [];"""
    if marker in pt and 'loadLiveMenu' not in pt:
        pt = pt.replace(marker, marker + """

  const loadLiveMenu = useCallback(async () => {
    if (!assignedRestaurantId) return;
    setMenuLoading(true);
    try {
      const res: any = await api.admin.getMenuItems();
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setLiveMenu(rows);
      setMenuMsg('');
    } catch (err: any) {
      setLiveMenu([]);
      setMenuMsg(err?.message || 'Could not load menu from D1');
    } finally {
      setMenuLoading(false);
    }
  }, [assignedRestaurantId]);

  useEffect(() => {
    if (activeTab === 'menu') loadLiveMenu();
  }, [activeTab, loadLiveMenu]);

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim() || !newDishPrice || !assignedRestaurantId) return;
    setSavingDish(true);
    setMenuMsg('');
    try {
      await api.admin.createMenuItem({
        name: newDishName.trim(),
        price: Number(newDishPrice),
        description: newDishDesc.trim(),
        restaurantId: assignedRestaurantId,
        category: 'Main Dishes',
      });
      setNewDishName('');
      setNewDishPrice('');
      setNewDishDesc('');
      setMenuMsg('Dish saved to D1. Visible to admin and public catalogue after LKG refresh.');
      await loadLiveMenu();
    } catch (err: any) {
      setMenuMsg(err?.message || 'Failed to save dish');
    } finally {
      setSavingDish(false);
    }
  };

  const handleToggleDish = async (id: string) => {
    try {
      await api.admin.toggleMenuItem(id);
      await loadLiveMenu();
      setMenuMsg('Availability updated in D1.');
    } catch (err: any) {
      setMenuMsg(err?.message || 'Toggle failed');
    }
  };
""")
        print('hooks')
    idx = pt.find('Live Menu Stock Controller')
    if idx > 0 and 'Add new dish (live D1)' not in pt:
        insert_at = pt.find('</div>', pt.find('</p>', idx)) + len('</div>')
        form = """

          {menuMsg ? (
            <div className=\"rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-950\">{menuMsg}</div>
          ) : null}

          <form onSubmit={handleCreateDish} className=\"grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4\">
            <div className=\"md:col-span-4 text-sm font-bold text-slate-900\">Add new dish (live D1 to admin to public catalogue)</div>
            <input required value={newDishName} onChange={(e) => setNewDishName(e.target.value)} placeholder=\"Dish name\" className=\"rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500\" />
            <input required type=\"number\" min={0} step={50} value={newDishPrice} onChange={(e) => setNewDishPrice(e.target.value)} placeholder=\"Price (NGN)\" className=\"rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500\" />
            <input value={newDishDesc} onChange={(e) => setNewDishDesc(e.target.value)} placeholder=\"Short description\" className=\"rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 md:col-span-2\" />
            <button type=\"submit\" disabled={savingDish} className=\"md:col-span-4 rounded-xl bg-[#FF5500] px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60\">
              {savingDish ? 'Saving to D1' : 'Save dish to D1'}
            </button>
          </form>

          <div className=\"space-y-2 rounded-2xl border border-slate-700 bg-slate-950/60 p-4\">
            <div className=\"flex items-center justify-between\">
              <h4 className=\"text-sm font-bold text-white\">Your kitchen menu (from D1)</h4>
              <button type=\"button\" onClick={loadLiveMenu} className=\"text-xs font-bold text-[#FF5500] hover:text-orange-400\">Refresh</button>
            </div>
            {menuLoading ? (
              <p className=\"text-xs text-slate-300\">Loading from D1</p>
            ) : liveMenu.length === 0 ? (
              <p className=\"text-xs text-slate-300\">No dishes in D1 yet. Add one above.</p>
            ) : (
              liveMenu.map((item) => (
                <div key={item.id} className=\"flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5\">
                  <div className=\"min-w-0\">
                    <div className=\"truncate text-sm font-semibold text-white\">{item.name}</div>
                    <div className=\"text-xs text-slate-300\">NGN {Number(item.price || 0).toLocaleString()} - {item.is_available === 0 ? 'Hidden' : 'Available'}</div>
                  </div>
                  <button type=\"button\" onClick={() => handleToggleDish(item.id)} className=\"shrink-0 rounded-lg border border-slate-500 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 hover:border-[#FF5500] hover:text-[#FF5500]\">
                    {item.is_available === 0 ? 'Restock' : 'Hide'}
                  </button>
                </div>
              ))
            )}
          </div>
"""
        pt = pt[:insert_at] + form + pt[insert_at:]
        print('form')
    p.write_text(pt)
    print('portal', len(pt))
else:
    print('portal already')
print('OK')
