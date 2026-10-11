#!/usr/bin/env python3
"""Apply restaurant ops route fixes on main (D1 live, no rest-1)."""
from pathlib import Path

# Copy pre-built route from this repo if present after checkout of companion commit;
# otherwise apply surgical patches.
route = Path('app/api/[[...route]]/route.ts')
t = route.read_text()

# GET menu auth - multiple possible current forms
if "admin sees all kitchens; restaurant sees own" not in t:
    # Unauthenticated form
    a = """  if (pathname === '/admin/menu') {
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC LIMIT 500', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""
    b = """  if (pathname === '/admin/menu') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role === 'restaurant') {
      const rid = user.restaurantId || (await d1.query('SELECT restaurant_id FROM users WHERE id = ? LIMIT 1', [user.id])).results?.[0]?.restaurant_id;
      if (!rid) return NextResponse.json({ success: true, data: [] });
      const d1Res = await d1.query('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 500', [rid], { cache: false });
      return NextResponse.json({ success: true, data: d1Res.results || [] });
    }
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC LIMIT 500', [], { cache: false });
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }"""
    if a in t:
        t = t.replace(a, b)
        print('GET menu')
    else:
        print('GET menu pattern skip')

# POST menu allow restaurant + require restaurantId
if "Your account is not linked to a restaurant kitchen" not in t:
    a = """    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { name, price, categoryId, category, restaurantId, description, isAvailable, popular, imageR2Url, imageUrl } = body;
    if (!name || price === undefined) {
      return NextResponse.json({ success: false, error: 'Name and price are required' }, { status: 400 });
    }
    const id = `item-${Date.now()}`;
    const now = new Date().toISOString();
    const targetRestaurantId = restaurantId || 'rest-1';"""
    b = """    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin' && user.role !== 'restaurant')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { name, price, categoryId, category, restaurantId, description, isAvailable, popular, imageR2Url, imageUrl } = body;
    if (!name || price === undefined) {
      return NextResponse.json({ success: false, error: 'Name and price are required' }, { status: 400 });
    }
    const id = `item-${Date.now()}`;
    const now = new Date().toISOString();
    let targetRestaurantId = restaurantId ? String(restaurantId) : '';
    if (user.role === 'restaurant') {
      targetRestaurantId = String(user.restaurantId || (await d1.query('SELECT restaurant_id FROM users WHERE id = ? LIMIT 1', [user.id])).results?.[0]?.restaurant_id || '');
      if (!targetRestaurantId) {
        return NextResponse.json({ success: false, error: 'Your account is not linked to a restaurant kitchen.' }, { status: 403 });
      }
    } else if (!targetRestaurantId) {
      return NextResponse.json({ success: false, error: 'restaurantId is required so the dish is tagged to a kitchen.' }, { status: 400 });
    }"""
    if a in t:
        t = t.replace(a, b)
        print('POST menu')
    else:
        print('POST menu skip')

# PATCH gate
if "user.role === 'restaurant' && menuPath" not in t:
    a = """export async function PATCH(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  if (pathname.startsWith('/admin/')) {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 401 });
    }
  }
  const body = await req.json().catch(() => ({}));
  const user = await getUser(req);"""
    b = """export async function PATCH(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));
  const user = await getUser(req);
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
  }"""
    if a in t:
        t = t.replace(a, b)
        print('PATCH gate')
    else:
        print('PATCH gate skip')

# Assign courier
if 'orderAssignMatch' not in t:
    a = "  // 1. Order Status Update\n  const orderStatusMatch = pathname.match(/^\\/(?:admin\\/)?orders\\/([^/]+)\\/status$/);"
    b = '''  // 0. Assign courier — admin or owning restaurant; live D1
  const orderAssignMatch = pathname.match(/^\\/(?:admin\\/)?orders\\/([^/]+)\\/assign$/);
  if (orderAssignMatch) {
    if (!user) return NextResponse.json({ success: false, error: \'Authentication required\' }, { status: 401 });
    const orderId = decodeURIComponent(orderAssignMatch[1]);
    const courierId = String(body.courierId || body.courier_id || \'\').trim();
    if (!courierId) return NextResponse.json({ success: false, error: \'courierId is required\' }, { status: 400 });
    const orderRes = await d1.query(\'SELECT id, restaurant_id, courier_id, status FROM orders WHERE id = ? OR short_id = ? LIMIT 1\', [orderId, orderId], { cache: false });
    if (!orderRes.success) return NextResponse.json({ success: false, error: \'Order lookup failed\' }, { status: 503 });
    const order = orderRes.results?.[0];
    if (!order) return NextResponse.json({ success: false, error: \'Order not found\' }, { status: 404 });
    const isAdmin = user.role === \'admin\' || user.role === \'sub_admin\';
    if (!isAdmin) {
      if (user.role !== \'restaurant\') return NextResponse.json({ success: false, error: \'Not authorized to assign couriers\' }, { status: 403 });
      const assigned = await d1.query(\'SELECT restaurant_id FROM users WHERE id = ? LIMIT 1\', [user.id]);
      const rid = assigned.results?.[0]?.restaurant_id || user.restaurantId;
      if (!rid || String(rid) !== String(order.restaurant_id)) {
        return NextResponse.json({ success: false, error: \'You can only assign couriers on your own kitchen orders\' }, { status: 403 });
      }
    }
    const courierCheck = await d1.query("SELECT id FROM users WHERE id = ? AND role = \'courier\' LIMIT 1", [courierId], { cache: false });
    if (!courierCheck.results?.[0]) {
      return NextResponse.json({ success: false, error: \'Courier not found\' }, { status: 404 });
    }
    const now = new Date().toISOString();
    const upd = await d1.query(
      \'UPDATE orders SET courier_id = ?, status = CASE WHEN status = ? OR status = ? THEN ? ELSE status END, updated_at = ? WHERE id = ?\',
      [courierId, \'ready_for_pickup\', \'confirmed\', \'in_transit\', now, order.id]
    );
    if (!upd.success) return NextResponse.json({ success: false, error: \'Assignment failed in D1\' }, { status: 503 });
    return NextResponse.json({ success: true, data: { orderId: order.id, courierId, assignedAt: now } });
  }

  // 1. Order Status Update
  const orderStatusMatch = pathname.match(/^\\/(?:admin\\/)?orders\\/([^/]+)\\/status$/);'''
    if a in t:
        t = t.replace(a, b)
        print('assign')
    else:
        print('assign skip')

t = t.replace("if (!['preparing', 'ready_for_pickup', 'cancelled'].includes(status))", "if (!['confirmed', 'preparing', 'ready_for_pickup', 'cancelled'].includes(status))")
t = t.replace("const targetRestaurantId = restaurantId || 'rest-1';", "/* no rest-1 */ let targetRestaurantId = String(restaurantId || ''); if (!targetRestaurantId) return NextResponse.json({ success: false, error: 'restaurantId required' }, { status: 400 });")

route.write_text(t)
print('DONE', len(t))
