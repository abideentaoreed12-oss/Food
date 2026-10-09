import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
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

function toPublicRestaurant(source: any, id: string) {
  const restaurant = source && typeof source === 'object' ? source : {};
  const fields = ['name','description','cuisine','tags','tagline','image','imageUrl','coverImage','logo','rating','reviewCount','deliveryTimeMin','deliveryFee','minimumOrder','minimumOrderAmount','isOpen','isAvailable','address','city','latitude','longitude','openingHours','categories','distanceKm','distanceText','durationText','calculatedDeliveryFee'];
  const result: any = { id };
  for (const field of fields) if (restaurant[field] !== undefined) result[field] = restaurant[field];
  result.categories = (Array.isArray(restaurant.categories) ? restaurant.categories : []).map((category: any) => ({
    name: typeof category?.name === 'string' ? category.name : '',
    items: (Array.isArray(category?.items) ? category.items : []).map((item: any) => {
      const safe: any = {};
      for (const field of ['id','name','description','price','image','imageUrl','isAvailable','isVegetarian','isVegan','dietary','tags','category','restaurantId','preparationTime','options','addons','discountPrice']) {
        if (item?.[field] !== undefined) safe[field] = item[field];
      }
      safe.restaurantId = safe.restaurantId || id;
      safe.category = safe.category || category?.name || '';
      return safe;
    })
  }));
  return result;
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
          "UPDATE orders SET payment_status = 'paid', status = 'placed', updated_at = ? WHERE id = ?",
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
    // Public health checks expose only a generic liveness result. Infrastructure
    // details, timings, uptime, and release versions remain private.
    return NextResponse.json(
      { status: 'ok' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
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

  if (pathname === '/restaurants') {
    const d1Res = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC LIMIT 200');
    if (!d1Res.success) return NextResponse.json({ success: false, error: 'Restaurant data is temporarily unavailable' }, { status: 503 });
    const q = (req.nextUrl.searchParams.get('search') || '').trim().toLocaleLowerCase();
    const cuisine = (req.nextUrl.searchParams.get('cuisine') || '').trim().toLocaleLowerCase();
    const dietary = (req.nextUrl.searchParams.get('dietary') || '').trim().toLocaleLowerCase();
    const all = (d1Res.results || []).map((row: any) => {
      let data: any = row;
      try { data = row.raw_json ? JSON.parse(row.raw_json) : row; } catch {}
      return toPublicRestaurant(data, String(row.id || data.id || ''));
    });
    const filtered = all.filter((r: any) => {
      const text = [r.name,r.cuisine,r.tagline,r.description,...(r.tags || []),...(r.categories || []).map((cat: any) => cat.name),...(r.categories || []).flatMap((cat: any) => (cat.items || []).flatMap((item: any) => [item.name,item.description,item.category]))].filter((v: any) => typeof v === 'string').join(' ').toLocaleLowerCase();
      return (!q || text.includes(q)) && (!cuisine || String(r.cuisine || '').toLocaleLowerCase().includes(cuisine)) && (!dietary || (r.categories || []).some((cat: any) => (cat.items || []).some((item: any) => Array.isArray(item.dietary) && item.dietary.some((tag: any) => String(tag).toLocaleLowerCase() === dietary))));
    });
    return NextResponse.json({ success: true, data: filtered }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } });
  }

  if (pathname === '/admin/restaurants') {
    const admin = await getUser(req);
    if (!admin) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    if (admin.role !== 'admin' && admin.role !== 'sub_admin') return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    const d1Res = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC LIMIT 200');
    if (!d1Res.success) {
      return NextResponse.json({ success: false, error: 'Restaurant data is temporarily unavailable' }, { status: 503 });
    }

    const normalizedQuery = (req.nextUrl.searchParams.get('search') || '').trim().toLocaleLowerCase();
    const cuisineFilter = (req.nextUrl.searchParams.get('cuisine') || '').trim().toLocaleLowerCase();
    const dietaryFilter = (req.nextUrl.searchParams.get('dietary') || '').trim().toLocaleLowerCase();

    const allRestaurants = (d1Res.results || []).map((row: any) => {
      let restaurant: any = row;
      try {
        restaurant = row.raw_json ? JSON.parse(row.raw_json) : row;
      } catch {
        restaurant = row;
      }
      const id = String(row.id || restaurant.id || '');
      const categories = Array.isArray(restaurant.categories) ? restaurant.categories : [];
      return {
        ...restaurant,
        id,
        categories: categories.map((category: any) => ({
          ...category,
          items: (Array.isArray(category.items) ? category.items : []).map((item: any) => ({
            ...item,
            restaurantId: item.restaurantId || id,
            category: item.category || category.name || ''
          }))
        }))
      };
    });

    const list = allRestaurants.filter((restaurant: any) => {
      const restaurantText = [
        restaurant.name, restaurant.cuisine, restaurant.tagline, restaurant.description,
        ...(Array.isArray(restaurant.tags) ? restaurant.tags : []),
        ...(Array.isArray(restaurant.categories) ? restaurant.categories.map((category: any) => category.name) : []),
        ...(Array.isArray(restaurant.categories) ? restaurant.categories.flatMap((category: any) =>
          (Array.isArray(category.items) ? category.items : []).flatMap((item: any) => [item.name, item.description, item.category])
        ) : [])
      ].filter((value) => typeof value === 'string').join(' ').toLocaleLowerCase();

      const matchesSearch = !normalizedQuery || restaurantText.includes(normalizedQuery);
      const matchesCuisine = !cuisineFilter || String(restaurant.cuisine || '').toLocaleLowerCase().includes(cuisineFilter);
      const matchesDietary = !dietaryFilter || (restaurant.categories || []).some((category: any) =>
        (category.items || []).some((item: any) =>
          Array.isArray(item.dietary) && item.dietary.some((tag: any) => String(tag).toLocaleLowerCase() === dietaryFilter)
        )
      );
      return matchesSearch && matchesCuisine && matchesDietary;
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
        const row = d1Res.results[0];
        let restaurant: any = row;
        try { restaurant = row.raw_json ? JSON.parse(row.raw_json) : row; } catch {}
        return NextResponse.json(
          { success: true, data: toPublicRestaurant(restaurant, String(row.id || restaurant.id || id)) },
          { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }
        );
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
    { success: false, error: 'Not found' },
    { status: 404 }
  );
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const rawBody = await req.text();
  let body: any = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

  // Paystack server-to-server webhook. Only a valid signature and a successful,
  // amount-matched charge.success event can mark an order paid.
  if (pathname === '/payments/webhook') {
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || '';
    const signature = req.headers.get('x-paystack-signature') || '';
    if (!secret || !signature || !rawBody) {
      return NextResponse.json({ success: false, error: 'Webhook signature is missing or not configured' }, { status: 401 });
    }
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const suppliedBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 });
    }

    if (body?.event !== 'charge.success' || !body?.data?.reference) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const reference = String(body.data.reference);
    const stored = await d1.query(
      'SELECT id, order_id, amount, currency, status FROM transactions WHERE reference = ? LIMIT 1',
      [reference]
    );
    if (!stored.success) {
      return NextResponse.json({ success: false, error: 'Could not read transaction record' }, { status: 503 });
    }
    const transaction: any = stored.results?.[0];
    if (!transaction) {
      // Do not acknowledge unknown references as successfully processed.
      return NextResponse.json({ success: false, error: 'Unknown transaction reference' }, { status: 404 });
    }
    const expectedKobo = Math.round(Number(transaction.amount) * 100);
    const paidKobo = Number(body.data.amount);
    if (!Number.isFinite(expectedKobo) || !Number.isFinite(paidKobo) || expectedKobo !== paidKobo ||
        String(body.data.currency || '').toUpperCase() !== String(transaction.currency || 'NGN').toUpperCase() ||
        String(body.data.status || '').toLowerCase() !== 'success') {
      return NextResponse.json({ success: false, error: 'Webhook payment amount, currency, or status did not match' }, { status: 409 });
    }
    const now = new Date().toISOString();
    const txUpdate = await d1.query(
      "UPDATE transactions SET status = 'completed' WHERE reference = ?",
      [reference]
    );
    if (!txUpdate.success) return NextResponse.json({ success: false, error: 'Could not update transaction status' }, { status: 503 });
    if (transaction.order_id) {
      const orderUpdate = await d1.query(
        "UPDATE orders SET payment_status = 'paid', status = 'placed', updated_at = ? WHERE id = ?",
        [now, transaction.order_id]
      );
      if (!orderUpdate.success) return NextResponse.json({ success: false, error: 'Could not activate paid order' }, { status: 503 });
    }
    return NextResponse.json({ received: true, success: true });
  }

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

  if (pathname === '/orders') {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const restaurantId = String(body.restaurantId || '').trim();
    const customerName = String(body.customerName || user.name || '').trim();
    const customerPhone = String(body.customerPhone || user.phone || '').trim();
    const customerAddress = String(body.customerAddress || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const currency = String(body.currency || 'NGN').toUpperCase();
    const paymentMethod = String(body.paymentMethod || 'Debit Card');
    const fulfillmentType = String(body.fulfillmentType || 'delivery');
    const walletDeduction = Math.max(0, Number(body.walletDeduction) || 0);

    if (!restaurantId || customerName.length < 2 || customerPhone.length < 6 ||
        (fulfillmentType !== 'pickup' && customerAddress.length < 5) ||
        !items.length || !['NGN', 'USD'].includes(currency)) {
      return NextResponse.json({ success: false, error: 'Order details are incomplete. Check your delivery address, contact details, and cart items.' }, { status: 400 });
    }

    const restaurantResult = await d1.query('SELECT id, name, raw_json FROM restaurants WHERE id = ? LIMIT 1', [restaurantId]);
    const restaurantRow: any = restaurantResult.results?.[0];
    if (!restaurantResult.success) {
      return NextResponse.json({ success: false, error: 'Restaurant data is temporarily unavailable.' }, { status: 503 });
    }
    if (!restaurantRow) {
      return NextResponse.json({ success: false, error: 'The selected restaurant could not be found.' }, { status: 404 });
    }

    let restaurant: any;
    try { restaurant = typeof restaurantRow.raw_json === 'string' ? JSON.parse(restaurantRow.raw_json) : restaurantRow.raw_json; }
    catch { return NextResponse.json({ success: false, error: 'Restaurant menu data is invalid.' }, { status: 503 }); }

    let verifiedSubtotal = 0;
    const verifiedItems: any[] = [];
    for (const item of items) {
      const menuItemId = String(item.menuItemId || item.id || '').trim();
      const quantity = Number(item.quantity);
      if (!menuItemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        return NextResponse.json({ success: false, error: 'One or more cart items are invalid.' }, { status: 400 });
      }
      let menuItem: any = null;
      for (const category of restaurant.categories || []) {
        const match = (category.items || []).find((candidate: any) => String(candidate.id) === menuItemId);
        if (match) { menuItem = match; break; }
      }
      if (!menuItem || menuItem.isAvailable === false) {
        return NextResponse.json({ success: false, error: 'A selected menu item is unavailable. Refresh the menu and try again.' }, { status: 409 });
      }
      let optionsTotal = 0;
      const selectedOptions = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
      for (const option of selectedOptions) {
        let trustedOption: any = null;
        for (const group of menuItem.customizations || menuItem.optionGroups || []) {
          trustedOption = (group.options || []).find((candidate: any) => String(candidate.id) === String(option.optionId));
          if (trustedOption) break;
        }
        if (!trustedOption) {
          return NextResponse.json({ success: false, error: 'A selected customization is no longer available. Refresh your cart and try again.' }, { status: 409 });
        }
        optionsTotal += Math.max(0, Number(trustedOption.price) || 0);
      }
      const unitPrice = Math.max(0, Number(menuItem.price) || 0) + optionsTotal;
      const itemTotal = Math.round(unitPrice * quantity * 100) / 100;
      verifiedSubtotal += itemTotal;
      verifiedItems.push({
        menuItemId, name: menuItem.name, price: Number(menuItem.price) || 0, quantity,
        selectedOptions, specialInstructions: String(item.specialInstructions || '').slice(0, 250), itemTotal
      });
    }

    const subtotal = Math.round(verifiedSubtotal * 100) / 100;
    const deliveryFee = fulfillmentType === 'pickup' ? 0 : Math.max(0, Number(body.deliveryFee) || 0);
    const serviceFee = Math.max(0, Number(body.serviceFee) || 0);
    const tip = Math.max(0, Number(body.tip) || 0);
    const discountAmount = Math.max(0, Number(body.discountAmount) || 0);
    const total = Math.max(0, Math.round((subtotal + deliveryFee + serviceFee + tip - discountAmount) * 100) / 100);
    const chargeAmount = Math.max(0, Math.round((total - Math.min(walletDeduction, total)) * 100) / 100);
    const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const shortId = `QB-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const drivingMinutes = Number(body.drivingMinutes);
    const isPickup = fulfillmentType === 'pickup';
    if (!isPickup && (!Number.isFinite(drivingMinutes) || drivingMinutes <= 0 || drivingMinutes > 600)) {
      return NextResponse.json({ success: false, error: 'A valid live road-routing duration is required before creating a delivery order.' }, { status: 400 });
    }
    const estimatedArrivalMinutes = isPickup ? 0 : Math.ceil(drivingMinutes) + 15;
    const paymentStatus = chargeAmount <= 0 ? 'paid' : 'pending';
    // An unpaid card order is not a successful/placed order yet.
    // Keep it explicitly awaiting payment until Paystack confirms the transaction.
    const orderStatus = chargeAmount > 0 && paymentMethod.toLowerCase().includes('debit')
      ? 'awaiting_payment'
      : 'placed';
    const order: any = {
      id: orderId, shortId, customerId: user.id, customerName, customerPhone, customerEmail: user.email,
      customerAddress, customerApartment: String(body.customerApartment || ''), deliveryNotes: String(body.deliveryNotes || ''),
      restaurantId, restaurantName: restaurant.name || restaurantRow.name, restaurantAddress: restaurant.address || '',
      items: verifiedItems, subtotal, deliveryFee, serviceFee, tip, discountAmount,
      walletDeduction: Math.min(walletDeduction, total), total, chargeAmount, currency, paymentMethod,
      paymentStatus, transactionRef: null, status: orderStatus, fulfillmentType,
      estimatedArrivalMinutes, routeProgress: 5, statusHistory: [],
      scheduledSlot: body.scheduledSlot || null, isContactless: Boolean(body.isContactless),
      createdAt: now, updatedAt: now
    };

    const inserted = await d1.query(
      `INSERT INTO orders (id, short_id, customer_id, customer_name, customer_phone, customer_address, restaurant_id, restaurant_name, items, total, currency, payment_method, payment_status, status, raw_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, shortId, user.id, customerName, customerPhone, customerAddress, restaurantId,
       order.restaurantName, JSON.stringify(verifiedItems), total, currency, paymentMethod,
       paymentStatus, orderStatus, JSON.stringify(order), now, now]
    );
    if (!inserted.success) {
      console.error('[Orders API] Failed to persist order to D1');
      return NextResponse.json({ success: false, error: 'Could not save your order. No payment has been started. Please try again.' }, { status: 503 });
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 });
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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'A valid email is required for Paystack checkout' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || !orderId) {
      return NextResponse.json({ success: false, error: 'A positive payment amount and order ID are required' }, { status: 400 });
    }

    const orderResult = await d1.query(
      'SELECT id, customer_id, total, currency, raw_json FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    const order = orderResult.results?.[0];
    if (!order || String(order.customer_id) !== String(user.id)) {
      return NextResponse.json({ success: false, error: 'Order was not found for this customer' }, { status: 404 });
    }

    let orderDetails: any = {};
    try { orderDetails = order.raw_json ? JSON.parse(String(order.raw_json)) : {}; } catch { orderDetails = {}; }
    const expectedAmount = Number(orderDetails.chargeAmount);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 ||
        Math.round(amount * 100) !== Math.round(expectedAmount * 100) ||
        String(order.currency || 'NGN').toUpperCase() !== 'NGN') {
      return NextResponse.json({ success: false, error: 'Payment amount does not match the saved amount due after wallet deduction' }, { status: 400 });
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
      return NextResponse.json({ success: false, isPaid: false, error: 'Authentication required' }, { status: 401 });
    }
    const reference = String(body.reference || '').trim();
    if (!reference || reference.length > 200) {
      return NextResponse.json({ success: false, isPaid: false, error: 'A valid payment reference is required' }, { status: 400 });
    }

    try {
      const stored = await d1.query(
        'SELECT id, order_id, amount, currency, status FROM transactions WHERE reference = ? LIMIT 1',
        [reference]
      );
      if (!stored.success) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment records are temporarily unavailable' }, { status: 503 });
      }
      const transaction: any = stored.results?.[0];
      if (!transaction) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment reference was not found' }, { status: 404 });
      }
      const orderResult = await d1.query(
        'SELECT id, customer_id, total, currency, payment_status FROM orders WHERE id = ? LIMIT 1',
        [transaction.order_id]
      );
      const order: any = orderResult.results?.[0];
      if (!order || String(order.customer_id) !== String(user.id)) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Order not found for this customer' }, { status: 404 });
      }

      const verified = await paymentGateway.verifyPayment(reference);
      if (!verified.success) {
        return NextResponse.json({ success: false, isPaid: false, error: verified.error || 'Paystack verification failed' }, { status: 502 });
      }
      if (!verified.isPaid) {
        return NextResponse.json({ success: false, isPaid: false, status: verified.status, error: 'Paystack has not confirmed this payment as successful' });
      }
      if (String(transaction.currency || 'NGN').toUpperCase() !== 'NGN' ||
          Math.round(Number(transaction.amount) * 100) !== Math.round(verified.amountNGN * 100)) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Verified payment amount or currency does not match the saved transaction' }, { status: 409 });
      }

      const now = new Date().toISOString();
      const txUpdate = await d1.query(
        "UPDATE transactions SET status = 'completed' WHERE reference = ?",
        [reference]
      );
      if (!txUpdate.success) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment succeeded but its transaction record could not be updated' }, { status: 503 });
      }
      const orderUpdate = await d1.query(
        "UPDATE orders SET payment_status = 'paid', status = 'placed', updated_at = ? WHERE id = ?",
        [now, order.id]
      );
      if (!orderUpdate.success) {
        return NextResponse.json({ success: false, isPaid: false, error: 'Payment succeeded but the order status could not be updated' }, { status: 503 });
      }

      return NextResponse.json({ success: true, isPaid: true, status: verified.status, reference, orderId: order.id, data: { isPaid: true, status: verified.status, reference, orderId: order.id } });
    } catch (error: any) {
      console.error('[Payment verification] Reconciliation failed:', error?.message || error);
      return NextResponse.json({ success: false, isPaid: false, error: 'Could not reconcile this payment. Please try again.' }, { status: 503 });
    }
  }

  return NextResponse.json(
    { success: false, error: 'Not found' },
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
    { success: false, error: 'Not found' },
    { status: 404 }
  );
}

export async function DELETE(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  return NextResponse.json(
    { success: false, error: 'Not found' },
    { status: 404 }
  );
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const requestOrigin = new URL(req.url).origin;
  const allowedOrigins = new Set([
    requestOrigin,
    'https://veyrang.com',
    'https://www.veyrang.com'
  ]);
  const headers = new Headers({
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600'
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return new Response(null, { status: 204, headers });
}
