import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1';
import { r2 } from '../../../lib/r2';
import { paymentGateway } from '../../../lib/payment';
import { calculateRestaurantDistanceMetrics } from '../../../server/utils/distance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

function verifyToken(req: NextRequest): any | null {
  if (!JWT_SECRET) return null;
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies.get('veyrang_token')?.value;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

async function getUser(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) return null;
  const d1Res = await d1
    .query(
      'SELECT id, email, role, name, phone, address, wallet_balance_ngn, wallet_balance_usd, saved_addresses FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    )
    .catch(() => ({ results: [] as any[] }));
  if (d1Res.results?.[0]) {
    const u = d1Res.results[0];
    let savedAddresses: any[] = [];
    try {
      savedAddresses =
        typeof u.saved_addresses === 'string'
          ? JSON.parse(u.saved_addresses)
          : u.saved_addresses || [];
    } catch {
      savedAddresses = [];
    }
    return {
      id: u.id,
      email: u.email,
      role: u.role || 'customer',
      name: u.name,
      phone: u.phone || '',
      address: u.address || '',
      walletBalanceNGN: Number(u.wallet_balance_ngn || 0),
      walletBalanceUSD: Number(u.wallet_balance_usd || 0),
      savedAddresses
    };
  }
  return decoded;
}

async function ensureSchema() {
  await d1
    .query(
      `CREATE TABLE IF NOT EXISTS promo_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        discount_type TEXT NOT NULL,
        value REAL NOT NULL,
        min_order_amount REAL DEFAULT 0,
        max_discount_cap REAL,
        usage_limit INTEGER DEFAULT 1000,
        times_used INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        expires_at TEXT,
        description TEXT,
        created_at TEXT NOT NULL
      )`
    )
    .catch(() => {});
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // Public payment callback verification: the opaque provider reference must already exist in D1.
  // Never trust the browser's claim of success; verify with Paystack and reconcile against the recorded amount.
  if (pathname === '/payments/verify' && req.nextUrl.searchParams.has('reference')) {
    const reference = (req.nextUrl.searchParams.get('reference') || '').trim();
    if (!reference || reference.length > 200) {
      return NextResponse.json({ success: false, isPaid: false, error: 'Valid payment reference is required' }, { status: 400 });
    }
    try {
      const stored = await d1.query(
        'SELECT id, order_id, amount, currency, status FROM transactions WHERE reference = ? LIMIT 1',
        [reference]
      );
      const transaction = stored.results?.[0];
      if (!transaction) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment reference was not found' }, { status: 404 });
      }
      const verified = await paymentGateway.verifyPayment(reference);
      if (!verified.success) {
        return NextResponse.json({ success: false, isPaid: false, error: verified.error || 'Payment provider verification failed' }, { status: 502 });
      }
      if (!verified.isPaid) {
        return NextResponse.json({ success: false, isPaid: false, status: verified.status, error: 'Payment has not completed successfully', reference });
      }
      const expectedAmount = Number(transaction.amount);
      if (!Number.isFinite(expectedAmount) || Math.round(expectedAmount * 100) !== Math.round(verified.amountNGN * 100)) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Verified payment amount does not match the recorded transaction' }, { status: 409 });
      }
      if (String(transaction.currency || 'NGN').toUpperCase() !== 'NGN') {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment currency does not match the recorded transaction' }, { status: 409 });
      }
      const now = new Date().toISOString();
      const updated = await d1.query(
        "UPDATE transactions SET status = 'completed' WHERE reference = ? AND status = 'pending'",
        [reference]
      );
      if (!updated.success) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Could not record verified payment status' }, { status: 503 });
      }
      if (transaction.order_id) {
        const orderUpdate = await d1.query(
          "UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ?",
          [now, transaction.order_id]
        );
        if (!orderUpdate.success) {
          return NextResponse.json({ success: false, isPaid: false, error: 'Payment verified but order status could not be updated' }, { status: 503 });
        }
      }
      return NextResponse.json({ success: true, isPaid: true, status: verified.status, reference });
    } catch (error) {
      console.error('[Payment verification] Failed to reconcile reference', error);
      return NextResponse.json({ success: false, isPaid: false, error: 'Payment verification is temporarily unavailable' }, { status: 503 });
    }
  }

  if (pathname === '/' || pathname === '/health') {
    const d1Status = await d1.ping();
    const r2Configured = r2.isConfigured();
    const healthy = d1Status.connected && r2Configured;
    return NextResponse.json({
      status: healthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        d1: { connected: d1Status.connected, latencyMs: d1Status.latencyMs },
        r2: { configured: r2Configured },
        routing: true
      },
      version: '2.6.0'
    }, { status: healthy ? 200 : 503 });
  }

  if (pathname === '/auth/me') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: { user } });
  }

  if (pathname === '/settings' || pathname === '/admin/settings') {
    const user = await getUser(req);
    const isAdmin = user && (user.role === 'admin' || user.role === 'sub_admin');
    const d1Res = await d1.query('SELECT key, value FROM platform_settings');
    if (!d1Res.success) {
      return NextResponse.json({ success: false, error: 'Platform settings are temporarily unavailable' }, { status: 503 });
    }
    const settingsMap: Record<string, any> = {};
    const SAFE = new Set([
      'currency_ngn_usd_rate',
      'base_service_fee_ngn',
      'base_service_fee_usd',
      'minimum_order_ngn',
      'minimum_order_usd',
      'support_phone',
      'support_email',
      'maintenance_mode',
      'delivery_notice'
    ]);
    for (const row of d1Res.results || []) {
      if (!isAdmin && !SAFE.has(row.key)) continue;
      try {
        settingsMap[row.key] = JSON.parse(row.value);
      } catch {
        settingsMap[row.key] = row.value;
      }
    }
    return NextResponse.json({ success: true, data: settingsMap, settings: settingsMap });
  }

  if (pathname === '/settings/zones' || pathname === '/admin/delivery-zones') {
    const d1Res = await d1.query(
      'SELECT * FROM delivery_zones WHERE is_active = 1 OR is_active IS NULL ORDER BY created_at DESC'
    );
    if (!d1Res.success) {
      return NextResponse.json({ success: false, error: 'Delivery zones are temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/restaurants' || pathname === '/admin/restaurants') {
    const d1Res = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC');
    if (!d1Res.success) {
      return NextResponse.json({ success: false, error: 'Restaurant data is temporarily unavailable' }, { status: 503 });
    }
    const list = (d1Res.results || []).map((r: any) => {
      try {
        return r.raw_json ? { ...JSON.parse(r.raw_json), id: r.id } : r;
      } catch {
        return r;
      }
    });
    return NextResponse.json({ success: true, data: list });
  }

  if (pathname.startsWith('/restaurants/')) {
    const id = pathname.split('/').filter(Boolean)[1];
    if (id && id !== 'calculate-distance') {
      const d1Res = await d1
        .query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [id])
        .catch(() => ({ results: [] as any[] }));
      if (d1Res.results?.[0]) {
        const r = d1Res.results[0];
        try {
          return NextResponse.json({
            success: true,
            data: r.raw_json ? JSON.parse(r.raw_json) : r
          });
        } catch {
          return NextResponse.json({ success: true, data: r });
        }
      }
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }
  }

  if (pathname === '/orders') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const isAdmin = user.role === 'admin' || user.role === 'sub_admin';
    const d1Res = isAdmin
      ? await d1.query('SELECT * FROM orders ORDER BY created_at DESC')
      : await d1.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [user.id]);
    if (!d1Res.success) {
      console.error('[Orders API] D1 order query failed');
      return NextResponse.json({ success: false, error: 'Orders are temporarily unavailable because the database query failed' }, { status: 503 });
    }
    const orders = (d1Res.results || []).map((o: any) => {
      try {
        return o.raw_json
          ? {
              ...JSON.parse(o.raw_json),
              id: o.id,
              status: o.status,
              paymentStatus: o.payment_status
            }
          : o;
      } catch {
        return o;
      }
    });
    return NextResponse.json({ success: true, data: orders });
  }

  if (pathname === '/admin/orders') {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }
    const result = await d1.query('SELECT * FROM orders ORDER BY created_at DESC');
    if (!result.success) {
      console.error('[Admin orders] D1 query failed');
      return NextResponse.json({ success: false, error: 'Order database is temporarily unavailable' }, { status: 503 });
    }
    const orders = (result.results || []).map((o: any) => {
      let parsed: any = {};
      try { if (o.raw_json) parsed = JSON.parse(o.raw_json); } catch { /* use authoritative columns */ }
      let items: any[] = [];
      try { items = Array.isArray(o.items) ? o.items : typeof o.items === 'string' ? JSON.parse(o.items) : []; } catch { /* use raw_json items below */ }
      return {
        ...parsed,
        id: o.id,
        shortId: o.short_id ?? parsed.shortId,
        customerId: o.customer_id ?? parsed.customerId,
        customerName: o.customer_name ?? parsed.customerName,
        customerPhone: o.customer_phone ?? parsed.customerPhone,
        customerAddress: o.customer_address ?? parsed.customerAddress,
        restaurantId: o.restaurant_id ?? parsed.restaurantId,
        restaurantName: o.restaurant_name ?? parsed.restaurantName,
        items: items.length ? items : (Array.isArray(parsed.items) ? parsed.items : []),
        subtotal: o.subtotal ?? parsed.subtotal,
        deliveryFee: o.delivery_fee ?? parsed.deliveryFee,
        serviceFee: o.service_fee ?? parsed.serviceFee,
        total: o.total ?? parsed.total,
        currency: o.currency ?? parsed.currency ?? 'NGN',
        paymentMethod: o.payment_method ?? parsed.paymentMethod,
        paymentStatus: o.payment_status ?? parsed.paymentStatus,
        status: o.status ?? parsed.status,
        createdAt: o.created_at ?? parsed.createdAt,
        updatedAt: o.updated_at ?? parsed.updatedAt
      };
    });
    return NextResponse.json({ success: true, data: orders });
  }

  if (pathname === '/admin/users') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query(
      'SELECT id, email, name, role, phone, address, wallet_balance_ngn, wallet_balance_usd, created_at FROM users ORDER BY created_at DESC'
    );
    if (!d1Res.success) {
      return NextResponse.json({ success: false, error: 'User records are temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/admin/overview') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const [users, orders] = await Promise.all([
      d1.query('SELECT count(*) as c FROM users'),
      d1.query('SELECT count(*) as c, sum(total) as gmv FROM orders')
    ]);
    if (!users.success || !orders.success) {
      return NextResponse.json({ success: false, error: 'Admin overview data is temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      data: {
        totalUsers: Number(users.results?.[0]?.c || 0),
        totalOrders: Number(orders.results?.[0]?.c || 0),
        grossMerchandiseVolume: Number(orders.results?.[0]?.gmv || 0)
      }
    });
  }

  if (pathname === '/auth/wallet/transactions') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1
      .query(
        'SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
        [user.id]
      )
      .catch(() => ({ results: [] as any[] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  return NextResponse.json(
    { success: false, error: `API route GET /api${pathname} not found.` },
    { status: 404 }
  );
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  // Live restaurant road-distance calculation. This catch-all Next.js route is the
  // production API entry point, so the Express-only route is not sufficient on Vercel.
  if (pathname === '/restaurants/calculate-distance') {
    const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId.trim() : '';
    const userAddress = typeof body.userAddress === 'string' ? body.userAddress.trim() : '';
    const userLat = body.userLat;
    const userLng = body.userLng;
    const hasCoordinates = Number.isFinite(userLat) && Number.isFinite(userLng) &&
      userLat >= -90 && userLat <= 90 && userLng >= -180 && userLng <= 180;

    if (!restaurantId) {
      return NextResponse.json({ success: false, error: 'A restaurant ID is required to calculate delivery distance.' }, { status: 400 });
    }
    if (!userAddress && !hasCoordinates) {
      return NextResponse.json({ success: false, error: 'Select a delivery address before calculating distance.' }, { status: 400 });
    }

    try {
      const restaurantResult = await d1.query(
        'SELECT * FROM restaurants WHERE id = ? LIMIT 1',
        [restaurantId]
      );
      if (!restaurantResult.success) {
        return NextResponse.json({ success: false, error: 'Restaurant data is temporarily unavailable from D1.' }, { status: 503 });
      }
      const row: any = restaurantResult.results?.[0];
      if (!row) {
        return NextResponse.json({ success: false, error: 'Restaurant was not found in D1.' }, { status: 404 });
      }

      let stored: any = {};
      try {
        stored = typeof row.raw_json === 'string' ? JSON.parse(row.raw_json) : (row.raw_json || {});
      } catch {
        return NextResponse.json({ success: false, error: 'Restaurant data in D1 is invalid.' }, { status: 503 });
      }
      const lat = stored.lat ?? stored.latitude ?? row.lat ?? row.latitude;
      const lng = stored.lng ?? stored.longitude ?? row.lng ?? row.longitude;
      const address = stored.address ?? row.address;
      const deliveryFee = stored.deliveryFee ?? stored.delivery_fee ?? row.delivery_fee ?? row.deliveryFee;

      if (lat === undefined || lng === undefined || !Number.isFinite(Number(lat)) ||
          !Number.isFinite(Number(lng)) || Number(lat) < -90 || Number(lat) > 90 ||
          Number(lng) < -180 || Number(lng) > 180) {
        return NextResponse.json({ success: false, error: 'This restaurant has no valid coordinates configured in D1.' }, { status: 422 });
      }
      if (typeof address !== 'string' || !address.trim()) {
        return NextResponse.json({ success: false, error: 'This restaurant has no address configured in D1.' }, { status: 422 });
      }
      if (deliveryFee === undefined || deliveryFee === null ||
          !Number.isFinite(Number(deliveryFee)) || Number(deliveryFee) < 0) {
        return NextResponse.json({ success: false, error: 'This restaurant has no valid delivery fee configured in D1.' }, { status: 422 });
      }

      const origin = hasCoordinates ? { lat: userLat, lng: userLng } : userAddress;
      const metrics = await calculateRestaurantDistanceMetrics({
        lat: Number(lat),
        lng: Number(lng),
        address: address.trim(),
        deliveryFee: Number(deliveryFee)
      }, origin);
      return NextResponse.json({ success: true, data: metrics });
    } catch (error) {
      console.error('[Live distance] Calculation failed:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Live road-distance calculation failed. Please retry.'
      }, { status: 502 });
    }
  }

  // Accept POST as well as PATCH for clients that still use the legacy method.
  const postRoleMatch = pathname.match(/^\/admin\/users\/([^/]+)\/role$/);
  if (postRoleMatch) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ success: false, error: 'Only Super Admins can change user roles' }, { status: 403 });
    const role = body?.role;
    if (!['customer', 'restaurant', 'courier', 'admin', 'sub_admin'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid user role' }, { status: 400 });
    }
    let userId: string;
    try { userId = decodeURIComponent(postRoleMatch[1]).trim(); }
    catch { return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 }); }
    if (!userId) return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    if (userId === user.id && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'You cannot remove your own Super Admin role' }, { status: 400 });
    }
    try {
      const update = await d1.query('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, new Date().toISOString(), userId]);
      if (!update.success) return NextResponse.json({ success: false, error: 'User role could not be updated in D1' }, { status: 503 });
      const result = await d1.query('SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1', [userId]);
      if (!result.success) return NextResponse.json({ success: false, error: 'Could not verify user role in D1' }, { status: 503 });
      if (!result.results?.[0]) return NextResponse.json({ success: false, error: 'User not found in D1' }, { status: 404 });
      if (result.results[0].role !== role) return NextResponse.json({ success: false, error: 'User role was not updated' }, { status: 503 });
      return NextResponse.json({ success: true, data: result.results[0], message: 'User role updated in D1' });
    } catch (error: any) {
      console.error('[Admin role update] D1 operation failed:', error?.message || error);
      return NextResponse.json({ success: false, error: 'User role update failed' }, { status: 503 });
    }
  }

  if (pathname === '/auth/login') {
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }
    if (!JWT_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Server auth not configured' },
        { status: 503 }
      );
    }

    if (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { id: 'usr-admin-1', email: ADMIN_EMAIL, role: 'admin', name: 'System Administrator' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: 'usr-admin-1',
            email: ADMIN_EMAIL,
            role: 'admin',
            name: 'System Administrator',
            walletBalanceNGN: 0,
            walletBalanceUSD: 0
          },
          token
        }
      });
    }

    const d1Res = await d1
      .query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
      .catch(() => ({ results: [] as any[] }));
    const u = d1Res.results?.[0];
    if (!u || !u.password_hash) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }
    const token = jwt.sign(
      { id: u.id, email: u.email, role: u.role || 'customer', name: u.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          phone: u.phone,
          walletBalanceNGN: Number(u.wallet_balance_ngn || 0),
          walletBalanceUSD: Number(u.wallet_balance_usd || 0)
        },
        token
      }
    });
  }

  if (pathname === '/auth/register') {
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    if (!email || !password || password.length < 8 || !name) {
      return NextResponse.json(
        { success: false, error: 'Valid name, email and password (8+) required' },
        { status: 400 }
      );
    }
    if (!JWT_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Server auth not configured' },
        { status: 503 }
      );
    }
    const existing = await d1
      .query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
      .catch(() => ({ results: [] as any[] }));
    if (existing.results?.length) {
      return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
    }
    const id = `usr-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO users (id, email, password_hash, name, role, phone, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'customer', ?, 0, 0, '[]', ?, ?)`,
      [id, email, hash, name, body.phone || null, now, now]
    );
    const token = jwt.sign({ id, email, role: 'customer', name }, JWT_SECRET, { expiresIn: '7d' });
    return NextResponse.json({
      success: true,
      data: {
        user: { id, email, name, role: 'customer', walletBalanceNGN: 0, walletBalanceUSD: 0 },
        token
      }
    });
  }

  if (pathname === '/auth/logout') {
    return NextResponse.json({ success: true, message: 'Logged out' });
  }

  if (pathname === '/payment/initialize') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const email = String(body.email || user.email || '').trim();
    const amount = Number(body.amount);
    const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};
    const orderId = String(metadata.orderId || '');
    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email is required for Paystack checkout' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || !orderId) {
      return NextResponse.json({ success: false, error: 'A positive payment amount and order ID are required' }, { status: 400 });
    }

    const orderResult = await d1.query(
      'SELECT id, customer_id, total, currency FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    const order = orderResult.results?.[0];
    if (!order || String(order.customer_id) !== String(user.id)) {
      return NextResponse.json({ success: false, error: 'Order was not found for this customer' }, { status: 404 });
    }

    const expectedAmount = Number(order.total);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || Math.round(amount * 100) > Math.round(expectedAmount * 100)) {
      return NextResponse.json({ success: false, error: 'Payment amount does not match the order total' }, { status: 400 });
    }

    const result = await paymentGateway.initializePayment({
      email,
      amountNGN: amount,
      callbackUrl: typeof body.callbackUrl === 'string' ? body.callbackUrl : `${req.nextUrl.origin}/?order_id=${encodeURIComponent(orderId)}`,
      metadata: { ...metadata, orderId, userId: user.id, type: 'order_payment', provider: 'paystack' }
    });
    if (!result.success || !result.authorizationUrl || !result.reference) {
      return NextResponse.json({ success: false, error: result.error || 'Paystack could not initialize this payment' }, { status: 502 });
    }

    const transactionId = `txn-${result.reference}`;
    const now = new Date().toISOString();
    const saved = await d1.query(
      `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
       VALUES (?, ?, ?, ?, 'NGN', 'pending', 'Paystack', ?)`,
      [transactionId, orderId, result.reference, amount, now]
    );
    if (!saved.success) {
      return NextResponse.json({ success: false, error: 'Could not save payment reference. Please contact support before retrying.' }, { status: 503 });
    }
    return NextResponse.json({
      success: true,
      data: { authorizationUrl: result.authorizationUrl, accessCode: result.accessCode, reference: result.reference }
    });
  }

  if (pathname === '/payment/verify') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const reference = String(body.reference || '');
    if (!reference) {
      return NextResponse.json({ success: false, error: 'Reference required' }, { status: 400 });
    }
    const result = await paymentGateway.verifyPayment(reference);
    return NextResponse.json({ ...result, data: result });
  }

  return NextResponse.json(
    { success: false, error: `API route POST /api${pathname} not found.` },
    { status: 404 }
  );
}

export async function PATCH(req: NextRequest) {
  await ensureSchema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  if (pathname === '/admin/users/role') {
    return NextResponse.json(
      { success: false, error: 'A user ID is required in the route: /api/admin/users/:id/role' },
      { status: 400 }
    );
  }

  const adminOrderStatusMatch = pathname.match(/^\/admin\/orders\/([^/]+)\/status$/);
  if (adminOrderStatusMatch) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: 'A valid JSON request body is required' }, { status: 400 });
    }
    const status = String(body?.status || '').trim();
    const allowedStatuses = new Set(['placed', 'confirmed', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'refunded']);
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ success: false, error: 'Invalid order status' }, { status: 400 });
    }
    let id: string;
    try { id = decodeURIComponent(adminOrderStatusMatch[1]).trim(); } catch {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }
    if (!id) return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    const current = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
    if (!current.success) return NextResponse.json({ success: false, error: 'Order database is temporarily unavailable' }, { status: 503 });
    const row = current.results?.[0];
    if (!row) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    let parsed: any = {};
    try { if (row.raw_json) parsed = JSON.parse(row.raw_json); } catch {
      return NextResponse.json({ success: false, error: 'Stored order data is invalid; no changes were made' }, { status: 500 });
    }
    const now = new Date().toISOString();
    const history = Array.isArray(parsed.statusHistory) ? parsed.statusHistory : [];
    const updatedOrder = { ...parsed, id: row.id, status, updatedAt: now, statusHistory: [...history, { status, timestamp: now, note: typeof body.note === 'string' ? body.note.slice(0, 500) : 'Status updated by admin' }] };
    const update = await d1.query('UPDATE orders SET status = ?, updated_at = ?, raw_json = ? WHERE id = ?', [status, now, JSON.stringify(updatedOrder), id]);
    if (!update.success) return NextResponse.json({ success: false, error: 'Order status could not be saved to D1' }, { status: 503 });
    const verify = await d1.query('SELECT status, updated_at, raw_json FROM orders WHERE id = ? LIMIT 1', [id]);
    if (!verify.success || !verify.results?.[0] || verify.results[0].status !== status) {
      return NextResponse.json({ success: false, error: 'Order status change could not be verified in D1' }, { status: 503 });
    }
    return NextResponse.json({ success: true, data: updatedOrder, message: 'Order status saved to D1' });
  }

  const roleMatch = pathname.match(/^\/admin\/users\/([^/]+)\/role$/);
  if (roleMatch) {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only Super Admins can change user roles' }, { status: 403 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'A valid JSON request body is required' }, { status: 400 });
    }

    const role = body?.role;
    if (!['customer', 'restaurant', 'courier', 'admin', 'sub_admin'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid user role' }, { status: 400 });
    }

    let userId: string;
    try {
      userId = decodeURIComponent(roleMatch[1]).trim();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }
    if (!userId) return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    if (userId === user.id && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'You cannot remove your own Super Admin role' }, { status: 400 });
    }

    try {
      const update = await d1.query('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, new Date().toISOString(), userId]);
      if (!update.success) {
        return NextResponse.json({ success: false, error: 'User role could not be updated in D1' }, { status: 503 });
      }
      if ((update.meta?.rows_written ?? 0) === 0) {
        const existing = await d1.query('SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!existing.success) return NextResponse.json({ success: false, error: 'Could not verify user after role update' }, { status: 503 });
        if (!existing.results?.length) return NextResponse.json({ success: false, error: 'User not found in D1' }, { status: 404 });
        if (existing.results[0].role !== role) return NextResponse.json({ success: false, error: 'User role was not updated' }, { status: 503 });
      }

      const result = await d1.query('SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1', [userId]);
      if (!result.success || !result.results?.[0]) {
        return NextResponse.json({ success: false, error: 'Role was updated but the result could not be verified' }, { status: 503 });
      }
      return NextResponse.json({ success: true, data: result.results[0], message: 'User role updated in D1' });
    } catch (error: any) {
      console.error('[Admin role update] D1 operation failed:', error?.message || error);
      return NextResponse.json({ success: false, error: 'User role update failed' }, { status: 503 });
    }
  }

  return NextResponse.json(
    { success: false, error: `API route PATCH /api${pathname} not found.` },
    { status: 404 }
  );
}

export async function DELETE(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  return NextResponse.json(
    { success: false, error: `API route DELETE /api${pathname} not found.` },
    { status: 404 }
  );
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
