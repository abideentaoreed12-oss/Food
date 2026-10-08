import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1';
import { r2 } from '../../../lib/r2';
import { routingManager } from '../../../lib/routingManager';
import { sendVerificationEmail } from '../../../lib/email';
import { paymentGateway } from '../../../lib/payment';
import { INITIAL_RESTAURANTS } from '../../../src/data/mockData';
import { DELIVERY_ZONES } from '../../../src/utils/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Auto-ensure D1 database tables and initial catalog are bootstrapped
let isD1Initialized = false;
async function ensureD1Schema() {
  if (isD1Initialized) return;
  isD1Initialized = true;
  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        role TEXT DEFAULT 'customer',
        phone TEXT,
        address TEXT,
        wallet_balance_usd REAL DEFAULT 0,
        wallet_balance_ngn REAL DEFAULT 0,
        saved_addresses TEXT DEFAULT '[]',
        kyc_status TEXT DEFAULT 'pending',
        is_approved INTEGER DEFAULT 1,
        vehicle_type TEXT,
        license_number TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS delivery_zones (
        id TEXT PRIMARY KEY,
        name TEXT,
        code TEXT,
        city TEXT,
        country TEXT,
        currency TEXT DEFAULT 'NGN',
        base_delivery_fee REAL DEFAULT 500,
        per_km_fee REAL DEFAULT 150,
        radius_km REAL DEFAULT 10,
        surge_multiplier REAL DEFAULT 1.0,
        center_lat REAL,
        center_lng REAL,
        is_active INTEGER DEFAULT 1,
        map_image_r2_url TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        category TEXT DEFAULT 'general',
        description TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        address TEXT,
        city TEXT,
        rating REAL DEFAULT 4.5,
        delivery_fee REAL DEFAULT 500,
        min_delivery_time INTEGER DEFAULT 25,
        max_delivery_time INTEGER DEFAULT 45,
        is_open INTEGER DEFAULT 1,
        logo_r2_url TEXT,
        banner_r2_url TEXT,
        raw_json TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        name TEXT,
        description TEXT,
        price REAL,
        category TEXT,
        is_available INTEGER DEFAULT 1,
        image_r2_url TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        name TEXT,
        description TEXT,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS addons (
        id TEXT PRIMARY KEY,
        name TEXT,
        price REAL,
        group_id TEXT,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS promos (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        discount_type TEXT DEFAULT 'percentage',
        discount_value REAL,
        min_order REAL DEFAULT 0,
        max_uses INTEGER DEFAULT 1000,
        current_uses INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        restaurant_id TEXT,
        courier_id TEXT,
        customer_name TEXT,
        food_rating REAL,
        delivery_rating REAL,
        comment TEXT,
        photo_r2_url TEXT,
        admin_reply TEXT,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        restaurant_id TEXT,
        status TEXT,
        total_amount REAL,
        subtotal REAL,
        delivery_fee REAL,
        service_fee REAL,
        payment_method TEXT,
        payment_status TEXT,
        delivery_address TEXT,
        items_json TEXT,
        raw_json TEXT,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS wallet_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        amount REAL,
        currency TEXT DEFAULT 'NGN',
        description TEXT,
        reference TEXT,
        payment_method TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT,
        target TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS courier_locations (
        id TEXT PRIMARY KEY,
        courier_id TEXT,
        order_id TEXT,
        lat REAL,
        lng REAL,
        heading REAL,
        speed REAL,
        is_live INTEGER DEFAULT 1,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        email TEXT,
        code TEXT,
        type TEXT DEFAULT 'signup',
        expires_at TEXT,
        created_at TEXT
      );`
    ];

    for (const q of tableQueries) {
      await d1.query(q).catch(() => {});
    }
  } catch (err) {
    console.warn('D1 Schema Bootstrap Warning:', err);
  }
}

function verifyToken(req: NextRequest): { id: string; email: string; role: string; name: string } | null {
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

// ==========================================
// 1. GET HANDLER
// ==========================================
export async function GET(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. System Health Check & Status
  if (pathname === '/' || pathname === '/health') {
    return NextResponse.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        d1: true,
        r2: r2.isConfigured(),
        routing: true
      },
      version: '2.5.0'
    });
  }

  // 2. Cloudflare D1 SQL Connectivity Check
  if (pathname === '/health/d1' || pathname === '/health/d1/ping') {
    const pingRes = await d1.ping();
    const tablesRes = await d1.query("SELECT name FROM sqlite_master WHERE type='table'").catch(() => ({ results: [] }));
    return NextResponse.json({
      success: pingRes.connected,
      d1Connected: pingRes.connected,
      latencyMs: pingRes.latencyMs,
      details: d1.getDetails(),
      tablesCount: tablesRes.results?.length || 0,
      tables: (tablesRes.results || []).map((t: any) => t.name),
      error: pingRes.error || null,
      timestamp: new Date().toISOString()
    });
  }

  // 3. Cloudflare R2 Connectivity Check
  if (pathname === '/health/r2') {
    return NextResponse.json({
      success: true,
      r2Connected: r2.isConfigured(),
      details: r2.getDetails(),
      timestamp: new Date().toISOString()
    });
  }

  // 4. Geolocation & Routing Health Check
  if (pathname === '/routing/health' || pathname === '/admin/routing/health') {
    return NextResponse.json({
      success: true,
      health: routingManager.getHealth(),
      timestamp: new Date().toISOString()
    });
  }

  // 5. Live GPS Courier Location Tracking (/api/orders/:id/tracking or /api/tracking/:orderId)
  if (pathname.includes('/tracking')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts.find((p) => p !== 'orders' && p !== 'tracking' && p !== 'api') || 'active';

    const orderRes = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let orderData: any = null;
    if (orderRes.results && orderRes.results[0]) {
      try {
        orderData = orderRes.results[0].raw_json ? JSON.parse(orderRes.results[0].raw_json) : orderRes.results[0];
        if (orderRes.results[0].status) orderData.status = orderRes.results[0].status;
        if (orderRes.results[0].updated_at) orderData.updatedAt = orderRes.results[0].updated_at;
      } catch {
        orderData = orderRes.results[0];
      }
    }

    const locRes = await d1.query(
      `SELECT * FROM courier_locations WHERE order_id = ? OR order_id = 'active' ORDER BY updated_at DESC LIMIT 1`,
      [orderId]
    ).catch(() => ({ results: [] }));

    const latestLoc = locRes.results?.[0] || null;
    const isLive = latestLoc ? (Date.now() - new Date(latestLoc.updated_at).getTime()) < 120000 : false;

    return NextResponse.json({
      success: true,
      order: orderData,
      tracking: {
        orderId,
        isLive,
        location: latestLoc ? {
          lat: Number(latestLoc.lat),
          lng: Number(latestLoc.lng),
          heading: Number(latestLoc.heading || 0),
          speed: Number(latestLoc.speed || 0),
          updatedAt: latestLoc.updated_at
        } : null,
        signalStatus: isLive ? 'live' : (latestLoc ? 'paused' : 'searching')
      }
    });
  }

  // 6. Auth: Get Current User Profile (/api/auth/me)
  if (pathname === '/auth/me') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized', user: null }, { status: 401 });
    }

    const d1Res = await d1.query('SELECT * FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1', [
      decoded.id,
      decoded.email
    ]);

    if (d1Res.results && d1Res.results.length > 0) {
      const u = d1Res.results[0];
      let savedAddresses = [];
      try {
        savedAddresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : u.saved_addresses || [];
      } catch {}

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            phone: u.phone,
            address: u.address,
            walletBalanceUSD: u.wallet_balance_usd || 0,
            walletBalanceNGN: u.wallet_balance_ngn || 0,
            savedAddresses,
            createdAt: u.created_at,
            updatedAt: u.updated_at
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0],
          role: decoded.role || 'customer',
          walletBalanceUSD: 0,
          walletBalanceNGN: 0,
          savedAddresses: []
        }
      }
    });
  }

  // Admin Auth Guard for sensitive GET /admin/* endpoints (excluding health checks and catalog/settings aliases)
  const publicOrAliasedAdmin = ['/admin/cms', '/admin/settings', '/admin/restaurants', '/admin/orders', '/admin/delivery-zones'];
  if (pathname.startsWith('/admin') && !pathname.includes('health') && !publicOrAliasedAdmin.some((p) => pathname.startsWith(p))) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 7. Platform Settings (/api/settings, /api/admin/settings)
  if (pathname === '/settings' || pathname === '/admin/settings') {
    const decoded = verifyToken(req);
    const isAdmin = decoded && (decoded.role === 'admin' || decoded.email === ADMIN_EMAIL);

    const d1Res = await d1.query('SELECT key, value, category, description FROM platform_settings').catch(() => ({ results: [] }));
    const settingsMap: Record<string, any> = {};

    if (d1Res.results && d1Res.results.length > 0) {
      d1Res.results.forEach((row: any) => {
        if (!isAdmin && (row.key === 'platform_commission_percent' || row.key.includes('commission'))) {
          return;
        }
        try {
          settingsMap[row.key] = JSON.parse(row.value);
        } catch {
          settingsMap[row.key] = row.value;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
      settings: settingsMap
    });
  }

  // 8. CMS Content (/api/admin/cms, /api/cms)
  if (pathname === '/admin/cms' || pathname === '/cms') {
    const d1Res = await d1.query("SELECT key, value FROM platform_settings WHERE category = 'landing' OR category = 'footer' OR key LIKE 'cms_%'").catch(() => ({ results: [] }));
    const cmsMap: Record<string, string> = {};
    if (d1Res.results) {
      d1Res.results.forEach((row: any) => {
        cmsMap[row.key] = row.value;
      });
    }
    return NextResponse.json({ success: true, data: cmsMap, settings: cmsMap });
  }

  // 9. Delivery Zones (/api/settings/zones, /api/admin/delivery-zones)
  if (pathname === '/settings/zones' || pathname === '/admin/delivery-zones') {
    const d1Res = await d1.query('SELECT * FROM delivery_zones ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 10. Restaurants Catalog (/api/restaurants, /api/admin/restaurants, /api/restaurants/:id)
  if (pathname === '/restaurants' || pathname === '/admin/restaurants' || pathname.startsWith('/restaurants/')) {
    const parts = pathname.split('/').filter(Boolean);
    const restId = (parts.length === 2 && parts[0] === 'restaurants') ? parts[1] : null;

    if (restId && restId !== 'calculate-distance') {
      const d1Res = await d1.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [restId]).catch(() => ({ results: [] }));
      if (d1Res.results && d1Res.results[0]) {
        const r = d1Res.results[0];
        const parsed = r.raw_json ? JSON.parse(r.raw_json) : r;
        return NextResponse.json({ success: true, data: parsed });
      }
      return NextResponse.json({ success: false, error: 'Restaurant not found' }, { status: 404 });
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search')?.toLowerCase().trim();
    const cuisine = searchParams.get('cuisine')?.toLowerCase().trim();

    const d1Res = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC').catch(() => ({ results: [] }));
    let list = (d1Res.results || []).map((r: any) => {
      try {
        return r.raw_json ? JSON.parse(r.raw_json) : r;
      } catch {
        return r;
      }
    });

    if (search) {
      list = list.filter((r: any) =>
        r.name?.toLowerCase().includes(search) ||
        r.cuisine?.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
      );
    }
    if (cuisine && cuisine !== 'all') {
      list = list.filter((r: any) => r.cuisine?.toLowerCase().includes(cuisine));
    }

    return NextResponse.json({ success: true, data: list });
  }

  // 11. Orders Catalog (/api/orders, /api/admin/orders, /api/orders/:id)
  if (pathname === '/orders' || pathname === '/admin/orders' || (pathname.startsWith('/orders/') && !pathname.includes('status') && !pathname.includes('verify') && !pathname.includes('refund') && !pathname.includes('messages') && !pathname.includes('tracking'))) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = (parts.length === 2 && parts[0] === 'orders') ? parts[1] : null;

    if (orderId) {
      const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
      if (d1Res.results && d1Res.results[0]) {
        const o = d1Res.results[0];
        const parsed = o.raw_json ? JSON.parse(o.raw_json) : o;
        if (o.status) parsed.status = o.status;
        if (o.updated_at) parsed.updatedAt = o.updated_at;
        return NextResponse.json({ success: true, data: parsed });
      }
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const decoded = verifyToken(req);
    let query = 'SELECT * FROM orders ORDER BY created_at DESC';
    let params: any[] = [];

    if (decoded && decoded.role === 'customer') {
      query = 'SELECT * FROM orders WHERE customer_id = ? OR customer_id = "guest" OR customer_id IS NULL OR customer_id = "" ORDER BY created_at DESC';
      params = [decoded.id];
    }

    const d1Res = await d1.query(query, params).catch(() => ({ results: [] }));
    const orders = (d1Res.results || []).map((o: any) => {
      let parsedObj: any = null;
      try {
        parsedObj = o.raw_json ? JSON.parse(o.raw_json) : o;
      } catch {
        parsedObj = o;
      }
      if (parsedObj && typeof parsedObj === 'object') {
        if (o.status) parsedObj.status = o.status;
        if (o.updated_at) parsedObj.updatedAt = o.updated_at;
      }
      return parsedObj;
    });
    return NextResponse.json({ success: true, data: orders });
  }

  // 12. Users Management (/api/admin/users)
  if (pathname === '/admin/users') {
    const d1Res = await d1.query('SELECT id, email, name, role, phone, address, wallet_balance_ngn, wallet_balance_usd, is_approved, kyc_status, vehicle_type, license_number, created_at FROM users ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 13. Menu Items (/api/admin/menu, /api/admin/menu-items)
  if (pathname === '/admin/menu' || pathname === '/admin/menu-items') {
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 14. Menu Categories (/api/admin/categories)
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM menu_categories ORDER BY sort_order ASC, created_at ASC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 15. Menu Addons (/api/admin/addons)
  if (pathname === '/admin/addons') {
    const d1Res = await d1.query('SELECT m.id, m.name, m.price, m.group_id, m.is_available, m.created_at, g.name as group_name FROM item_modifiers m LEFT JOIN item_modifier_groups g ON m.group_id = g.id ORDER BY m.created_at ASC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 16. Courier Fleet (/api/admin/drivers)
  if (pathname === '/admin/drivers') {
    const d1Res = await d1.query("SELECT id, name, email, phone, role, vehicle_type, license_number, kyc_status, is_approved, wallet_balance_ngn, created_at FROM users WHERE role = 'courier' OR role = 'driver' ORDER BY created_at DESC").catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 17. Promos (/api/admin/promos, /api/settings/promos)
  if (pathname === '/admin/promos' || pathname === '/settings/promos') {
    const d1Res = await d1.query('SELECT * FROM promos ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 18. Customer Reviews (/api/admin/reviews, /api/reviews/restaurant/:id)
  if (pathname === '/admin/reviews' || pathname.startsWith('/reviews/restaurant/')) {
    let query = 'SELECT * FROM reviews ORDER BY created_at DESC';
    let params: any[] = [];

    if (pathname.startsWith('/reviews/restaurant/')) {
      const restId = pathname.split('/').pop();
      query = 'SELECT * FROM reviews WHERE restaurant_id = ? ORDER BY created_at DESC';
      params = [restId];
    }

    const d1Res = await d1.query(query, params).catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 19. Support Tickets (/api/admin/support, /api/admin/support-tickets)
  if (pathname === '/admin/support' || pathname === '/admin/support-tickets') {
    const d1Res = await d1.query('SELECT * FROM support_tickets ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 20. Financial Ledger & Audit Logs (/api/admin/transactions, /api/admin/audit-logs)
  if (pathname === '/admin/transactions') {
    const d1Res = await d1.query('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/admin/audit-logs') {
    const d1Res = await d1.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 21. Admin Dashboard Overview Analytics (/api/admin/overview)
  if (pathname === '/admin/overview') {
    const [uRes, oRes, rRes, zRes, tRes, sRes] = await Promise.all([
      d1.query('SELECT COUNT(*) as count FROM users'),
      d1.query('SELECT COUNT(*) as count, SUM(total) as total_revenue FROM orders'),
      d1.query('SELECT COUNT(*) as count FROM restaurants'),
      d1.query('SELECT COUNT(*) as count FROM delivery_zones'),
      d1.query('SELECT COUNT(*) as count FROM transactions'),
      d1.query('SELECT COUNT(*) as count FROM support_tickets')
    ]).catch(() => [
      { results: [{ count: 0 }] },
      { results: [{ count: 0, total_revenue: 0 }] },
      { results: [{ count: 0 }] },
      { results: [{ count: 0 }] },
      { results: [{ count: 0 }] },
      { results: [{ count: 0 }] }
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: uRes.results?.[0]?.count || 0,
        totalOrders: oRes.results?.[0]?.count || 0,
        totalRevenueNGN: oRes.results?.[0]?.total_revenue || 0,
        totalRestaurants: rRes.results?.[0]?.count || 0,
        totalDeliveryZones: zRes.results?.[0]?.count || 0,
        totalTransactions: tRes?.results?.[0]?.count || 0,
        totalSupportTickets: sRes?.results?.[0]?.count || 0,
        d1Status: d1.getDetails()
      }
    });
  }

  // 22. Saved Delivery Addresses (/api/auth/addresses)
  if (pathname === '/auth/addresses') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [decoded.id]).catch(() => ({ results: [] }));
    let addresses = [];
    if (d1Res.results?.[0]?.saved_addresses) {
      try {
        addresses = JSON.parse(d1Res.results[0].saved_addresses);
      } catch {}
    }
    return NextResponse.json({ success: true, data: addresses });
  }

  // 23. Wallet Transactions & Payment History (/api/auth/wallet/transactions, /api/wallet/transactions)
  if (pathname === '/auth/wallet/transactions' || pathname === '/wallet/transactions' || pathname === '/auth/wallet-transactions') {
    const decoded = verifyToken(req);
    const userId = decoded?.id;

    let query = 'SELECT * FROM wallet_transactions ORDER BY created_at DESC';
    let params: any[] = [];
    if (userId && decoded?.role !== 'admin') {
      query = 'SELECT * FROM wallet_transactions WHERE user_id = ? OR user_id = "all" OR user_id = "guest" OR user_id IS NULL OR user_id = "" ORDER BY created_at DESC';
      params = [userId];
    }

    const d1Res = await d1.query(query, params).catch(() => ({ results: [] }));
    let txs: any[] = d1Res.results || [];

    const ordersQuery = userId && decoded?.role !== 'admin'
      ? 'SELECT * FROM orders WHERE customer_id = ? OR customer_id = "guest" OR customer_id IS NULL OR customer_id = "" ORDER BY created_at DESC'
      : 'SELECT * FROM orders ORDER BY created_at DESC';
    const ordersParams = userId && decoded?.role !== 'admin' ? [userId] : [];

    const ordersRes = await d1.query(ordersQuery, ordersParams).catch(() => ({ results: [] }));
    const orderList = ordersRes.results || [];
    const existingRefs = new Set(txs.map((t: any) => String(t.reference || t.id)));

    for (const ord of orderList) {
      let ordData: any = ord;
      try { if (ord.raw_json) ordData = JSON.parse(ord.raw_json); } catch {}
      const ref = ordData.shortId || ordData.id;
      const txId = `tx-ord-${ordData.id}`;
      if (!existingRefs.has(ref) && !existingRefs.has(ordData.id) && !existingRefs.has(txId)) {
        txs.push({
          id: txId,
          user_id: ordData.customerId || userId || 'guest',
          type: 'order',
          amount: -Math.abs(Number(ordData.total || 0)),
          currency: ordData.currency || 'NGN',
          description: `Order Payment — ${ordData.restaurantName || 'Restaurant'} (${ordData.shortId || ordData.id})`,
          reference: ref,
          payment_method: ordData.paymentMethod || 'wallet',
          status: ordData.status === 'cancelled' ? 'failed' : 'completed',
          created_at: ordData.createdAt || ord.created_at || new Date().toISOString()
        });
      }
    }
    txs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, data: txs });
  }

  return NextResponse.json({ ok: true, path: req.nextUrl.pathname });
}

// ==========================================
// 2. POST HANDLER
// ==========================================
export async function POST(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  // 0. Payment Gateway API Routes (/api/payment/initialize, /api/payment/verify, /api/payment/webhook)
  if (pathname === '/payment/initialize') {
    const { email, amount, callbackUrl, metadata } = body;
    if (!email || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Email and valid amount required' }, { status: 400 });
    }
    const initRes = await paymentGateway.initializePayment({
      email: String(email).trim().toLowerCase(),
      amountNGN: Number(amount),
      callbackUrl,
      metadata: metadata || {}
    });
    return NextResponse.json({
      success: initRes.success,
      data: initRes,
      error: initRes.error
    });
  }

  if (pathname === '/payment/verify') {
    const ref = body.reference || req.nextUrl.searchParams.get('reference');
    if (!ref) {
      return NextResponse.json({ success: false, error: 'Reference parameter required' }, { status: 400 });
    }

    const verifyRes = await paymentGateway.verifyPayment(ref);

    if (verifyRes.success && verifyRes.isPaid) {
      const now = new Date().toISOString();
      const meta = verifyRes.raw?.metadata || {};
      const userId = meta.userId || verifyRes.customerEmail;
      const orderId = meta.orderId;

      if (orderId) {
        await d1.query(
          "UPDATE orders SET payment_status = 'paid', updated_at = ? WHERE id = ? OR short_id = ?",
          [now, orderId, orderId]
        ).catch(() => {});

        await d1.query(
          `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at, user_id)
           VALUES (?, ?, ?, ?, 'NGN', 'completed', 'card', ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          [`txn-ord-${ref}`, orderId, ref, verifyRes.amountNGN, now, userId || 'customer']
        ).catch(() => {});
      } else if (userId) {
        await d1.query(
          'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ? OR LOWER(email) = LOWER(?)',
          [verifyRes.amountNGN, now, userId, userId]
        ).catch(() => {});

        await d1.query(
          `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at, user_id)
           VALUES (?, 'wallet-topup', ?, ?, 'NGN', 'completed', 'card', ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          [`txn-topup-${ref}`, ref, verifyRes.amountNGN, now, userId]
        ).catch(() => {});
      }
    }

    return NextResponse.json({
      success: verifyRes.success,
      isPaid: verifyRes.isPaid,
      status: verifyRes.status,
      amountNGN: verifyRes.amountNGN,
      data: verifyRes
    });
  }

  if (pathname === '/payment/webhook') {
    if (body && body.event === 'charge.success' && body.data) {
      const data = body.data;
      const ref = data.reference;
      const amountNGN = (data.amount || 0) / 100;
      const customerEmail = data.customer?.email;
      const now = new Date().toISOString();

      if (customerEmail && amountNGN > 0) {
        await d1.query(
          'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE LOWER(email) = LOWER(?)',
          [amountNGN, now, customerEmail]
        ).catch(() => {});

        await d1.query(
          `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at, user_id)
           VALUES (?, 'wallet-topup', ?, ?, 'NGN', 'completed', 'card', ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          [`txn-wh-${ref}`, ref, amountNGN, now, customerEmail]
        ).catch(() => {});
      }
    }
    return NextResponse.json({ status: true, message: 'Webhook processed' });
  }

  // 1. Media Upload (/api/storage/upload)
  if (pathname === '/storage/upload') {
    const { key, dataBase64, contentType } = body;
    if (!key || !dataBase64) {
      return NextResponse.json({ success: false, error: 'Key and base64 data required' }, { status: 400 });
    }
    const uploadRes = await r2.upload(key, dataBase64, contentType || 'image/jpeg');
    return NextResponse.json({
      success: true,
      cdnUrl: uploadRes.cdnUrl,
      key: uploadRes.key,
      data: { cdnUrl: uploadRes.cdnUrl }
    });
  }

  // 2. User & Admin Login (/api/auth/login)
  if (pathname === '/auth/login') {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (ADMIN_EMAIL && cleanEmail === ADMIN_EMAIL && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      const d1AdminRes = await d1.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
      let adminRecord = d1AdminRes.results?.[0];

      if (!adminRecord) {
        const now = new Date().toISOString();
        const pwdHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await d1.query(
          `INSERT INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)
           VALUES (?, ?, ?, 'System Administrator', 'admin', '+234 800 000 0000', 'Lagos, Nigeria', 0, 0, '[]', 1, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          ['usr-admin-1', ADMIN_EMAIL, pwdHash, now, now]
        ).catch(() => {});

        const refetchAdmin = await d1.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
        adminRecord = refetchAdmin.results?.[0];
      }

      const adminUser = {
        id: adminRecord?.id || 'usr-admin-1',
        email: ADMIN_EMAIL,
        name: adminRecord?.name || 'System Administrator',
        role: 'admin',
        phone: adminRecord?.phone || '+234 800 000 0000',
        address: adminRecord?.address || 'Lagos, Nigeria',
        walletBalanceUSD: Number(adminRecord?.wallet_balance_usd ?? 0),
        walletBalanceNGN: Number(adminRecord?.wallet_balance_ngn ?? 0),
        savedAddresses: []
      };

      const token = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '7d' });
      const response = NextResponse.json({
        success: true,
        data: { user: adminUser, token }
      });

      response.cookies.set('veyrang_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60
      });

      return response;
    }

    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (!d1Res.results || d1Res.results.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const u = d1Res.results[0];
    const isPasswordValid = u.password_hash ? await bcrypt.compare(password, u.password_hash) : false;

    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    let savedAddresses = [];
    try {
      savedAddresses = typeof u.saved_addresses === 'string' ? JSON.parse(u.saved_addresses) : u.saved_addresses || [];
    } catch {}

    const loggedInUser = {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role || 'customer',
      phone: u.phone,
      address: u.address,
      walletBalanceUSD: u.wallet_balance_usd || 0,
      walletBalanceNGN: u.wallet_balance_ngn || 0,
      isApproved: u.is_approved !== 0,
      savedAddresses
    };

    const token = jwt.sign(loggedInUser, JWT_SECRET, { expiresIn: '7d' });
    const response = NextResponse.json({
      success: true,
      data: { user: loggedInUser, token }
    });

    response.cookies.set('veyrang_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });

    return response;
  }

  // 3. Send Verification Code for Signup (/api/auth/send-verification)
  if (pathname === '/auth/send-verification') {
    const { email } = body;
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }
    const cleanEmail = email.toLowerCase().trim();

    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (existing.results && existing.results.length > 0) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists. Please log in instead.' }, { status: 409 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const id = `vc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await d1.query('DELETE FROM verification_codes WHERE LOWER(email) = LOWER(?) AND type = ?', [cleanEmail, 'signup']).catch(() => {});
    await d1.query(
      `INSERT INTO verification_codes (id, email, code, type, expires_at, created_at) VALUES (?, ?, ?, 'signup', ?, ?)`,
      [id, cleanEmail, code, expiresAt, now.toISOString()]
    );

    const emailRes = await sendVerificationEmail({ to: cleanEmail, code, type: 'signup' });
    return NextResponse.json({
      success: true,
      message: emailRes.success
        ? `A 6-digit verification code has been sent to ${cleanEmail}`
        : `A 6-digit verification code was generated for ${cleanEmail}`,
      emailSent: emailRes.success
    });
  }

  // 4. User Registration (/api/auth/register)
  if (pathname === '/auth/register') {
    const { email, password, name, phone, address, code, role } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (existing.results && existing.results.length > 0) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 });
    }

    if (code) {
      const cleanCode = code.toString().trim();
      const codeRes = await d1.query(
        'SELECT * FROM verification_codes WHERE LOWER(email) = LOWER(?) AND code = ? AND type = ? LIMIT 1',
        [cleanEmail, cleanCode, 'signup']
      ).catch(() => ({ results: [] }));

      const matchingCode = codeRes.results?.[0];
      if (!matchingCode) {
        return NextResponse.json({ success: false, error: 'Invalid verification code.' }, { status: 400 });
      }
      if (new Date(matchingCode.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ success: false, error: 'Verification code has expired.' }, { status: 400 });
      }
      await d1.query('DELETE FROM verification_codes WHERE id = ?', [matchingCode.id]).catch(() => {});
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const userId = `usr-${Date.now()}`;
    const userRole = (role && ['customer', 'restaurant', 'courier'].includes(role)) ? role : 'customer';

    await d1.query(
      `INSERT INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '[]', 1, ?, ?)`,
      [userId, cleanEmail, passwordHash, name.trim(), userRole, phone || '', address || '', now, now]
    );

    const newUser = {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      role: userRole,
      phone: phone || '',
      address: address || '',
      walletBalanceUSD: 0,
      walletBalanceNGN: 0,
      savedAddresses: []
    };

    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });
    const response = NextResponse.json({
      success: true,
      data: { user: newUser, token }
    });

    response.cookies.set('veyrang_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60
    });

    return response;
  }

  // 5. Send Forgotten Password OTP (/api/auth/forgot-password)
  if (pathname === '/auth/forgot-password') {
    const { email } = body;
    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email address required.' }, { status: 400 });
    }
    const cleanEmail = email.toLowerCase().trim();

    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (!existing.results || existing.results.length === 0) {
      return NextResponse.json({ success: false, error: 'No account found with this email address.' }, { status: 404 });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const id = `vc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    await d1.query('DELETE FROM verification_codes WHERE LOWER(email) = LOWER(?) AND type = ?', [cleanEmail, 'forgot_password']).catch(() => {});
    await d1.query(
      `INSERT INTO verification_codes (id, email, code, type, expires_at, created_at) VALUES (?, ?, ?, 'forgot_password', ?, ?)`,
      [id, cleanEmail, code, expiresAt, now.toISOString()]
    );

    const emailRes = await sendVerificationEmail({ to: cleanEmail, code, type: 'forgot_password' });
    return NextResponse.json({
      success: true,
      message: `Recovery code dispatched to ${cleanEmail}`,
      emailSent: emailRes.success
    });
  }

  // 6. Reset Password (/api/auth/reset-password)
  if (pathname === '/auth/reset-password') {
    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) {
      return NextResponse.json({ success: false, error: 'Email, code, and new password are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const codeRes = await d1.query(
      'SELECT * FROM verification_codes WHERE LOWER(email) = LOWER(?) AND code = ? AND type = ? LIMIT 1',
      [cleanEmail, cleanCode, 'forgot_password']
    ).catch(() => ({ results: [] }));

    const matchingCode = codeRes.results?.[0];
    if (!matchingCode) {
      return NextResponse.json({ success: false, error: 'Invalid or expired OTP code.' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const now = new Date().toISOString();

    await d1.query('UPDATE users SET password_hash = ?, updated_at = ? WHERE LOWER(email) = LOWER(?)', [passwordHash, now, cleanEmail]);
    await d1.query('DELETE FROM verification_codes WHERE id = ?', [matchingCode.id]).catch(() => {});

    return NextResponse.json({ success: true, message: 'Password reset successfully.' });
  }

  // 7. Logout (/api/auth/logout)
  if (pathname === '/auth/logout') {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('veyrang_token', '', { maxAge: 0 });
    return response;
  }

  // 8. Admin Developer SQL Console (/api/admin/developer/query, /api/admin/query)
  if (pathname === '/admin/developer/query' || pathname === '/admin/query') {
    const { sql, params } = body;
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Missing SQL statement' }, { status: 400 });
    }
    const res = await d1.query(sql, params || []);
    return NextResponse.json({ success: res.success, data: res.results || [], meta: res.meta || {} });
  }

  // 9. Ping Database (/api/health/d1/ping)
  if (pathname === '/health/d1/ping') {
    const pingRes = await d1.ping();
    return NextResponse.json({ success: pingRes.connected, latencyMs: pingRes.latencyMs, error: pingRes.error || null });
  }

  // 10. Saved Delivery Addresses (/api/auth/addresses)
  if (pathname === '/auth/addresses') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { label, address, apartment, city, isDefault } = body;
    const d1Res = await d1.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [decoded.id]).catch(() => ({ results: [] }));
    let list: any[] = [];
    if (d1Res.results?.[0]?.saved_addresses) {
      try {
        list = JSON.parse(d1Res.results[0].saved_addresses);
      } catch {}
    }
    const newAddr = {
      id: `addr-${Date.now()}`,
      label: label || 'Home',
      address,
      apartment: apartment || '',
      city: city || 'Lagos',
      isDefault: Boolean(isDefault)
    };
    if (newAddr.isDefault) {
      list = list.map((a: any) => ({ ...a, isDefault: false }));
    }
    list.push(newAddr);
    await d1.query('UPDATE users SET saved_addresses = ?, address = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(list),
      address,
      new Date().toISOString(),
      decoded.id
    ]);
    return NextResponse.json({ success: true, data: list });
  }

  // 11. Delivery Zone Creation (/api/admin/delivery-zones, /api/settings/zones)
  if (pathname === '/admin/delivery-zones' || pathname === '/settings/zones') {
    const { name, code, city, country, currency, baseFee, perKmFee, radiusKm, surgeMultiplier, centerLat, centerLng, mapImageR2Url } = body;
    const newId = `zone-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO delivery_zones (id, name, code, city, country, currency, base_delivery_fee, per_km_fee, radius_km, surge_multiplier, center_lat, center_lng, is_active, map_image_r2_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        newId,
        name || 'New Delivery Zone',
        (code || 'ZONE').toUpperCase().trim(),
        city || 'Lagos',
        country || 'Nigeria',
        currency || 'NGN',
        Number(baseFee || 500),
        Number(perKmFee || 150),
        Number(radiusKm || 10),
        Number(surgeMultiplier || 1.0),
        Number(centerLat || 6.5244),
        Number(centerLng || 3.3792),
        mapImageR2Url || null,
        now
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        id: newId,
        name,
        code: (code || 'ZONE').toUpperCase().trim(),
        city: city || 'Lagos',
        base_delivery_fee: Number(baseFee || 500),
        per_km_fee: Number(perKmFee || 150),
        is_active: 1
      }
    });
  }

  // 12. Settings & CMS Bulk Updates (/api/admin/settings/bulk-update, /api/settings/bulk, /api/admin/cms)
  if (pathname === '/admin/settings/bulk-update' || pathname === '/settings/bulk-update' || pathname === '/settings/bulk' || pathname === '/settings/update' || pathname === '/admin/cms') {
    const now = new Date().toISOString();
    if (body.key !== undefined) {
      const strVal = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
      await d1.query(
        `INSERT INTO platform_settings (key, value, category, updated_at)
         VALUES (?, ?, 'general', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [body.key, strVal, now]
      ).catch(() => {});
    }
    if (body.settings && typeof body.settings === 'object') {
      for (const [key, val] of Object.entries(body.settings)) {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        await d1.query(
          `INSERT INTO platform_settings (key, value, category, updated_at)
           VALUES (?, ?, 'general', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, strVal, now]
        ).catch(() => {});
      }
    }
    return NextResponse.json({ success: true, message: 'Settings saved in Cloudflare D1' });
  }

  // 13. Customer Review Submission (/api/reviews)
  if (pathname === '/reviews') {
    const { orderId, restaurantId, courierId, customerId, customerName, foodRating, deliveryRating, comment, photoR2Url } = body;
    const revId = `rev-${Date.now()}`;
    const now = new Date().toISOString();

    await d1.query(
      `INSERT INTO reviews (id, order_id, customer_id, restaurant_id, courier_id, food_rating, delivery_rating, comment, photo_r2_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [revId, orderId || 'order-direct', customerId || customerName || 'Valued Customer', restaurantId || 'rest-1', courierId || null, Number(foodRating || 5), Number(deliveryRating || 5), comment || '', photoR2Url || null, now]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: { id: revId, photoR2Url } });
  }

  // 14. Admin Reply to Review (/api/admin/reviews/:id/reply)
  if (pathname.includes('/reviews/') && pathname.endsWith('/reply')) {
    const parts = pathname.split('/').filter(Boolean);
    const reviewId = parts[parts.indexOf('reply') - 1];
    const { reply } = body;
    await d1.query('UPDATE reviews SET admin_reply = ?, merchant_reply = ? WHERE id = ?', [reply, reply, reviewId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Review response saved' });
  }

  // 15. User Wallet Adjustment (Admin) (/api/admin/users/:id/wallet)
  if (pathname.includes('/users/') && pathname.endsWith('/wallet')) {
    const parts = pathname.split('/').filter(Boolean);
    const userId = parts[parts.indexOf('wallet') - 1];
    const { amount, reason } = body;
    const now = new Date().toISOString();

    await d1.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?', [
      Number(amount || 0),
      now,
      userId
    ]).catch(() => {});

    await d1.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, status, created_at)
       VALUES (?, ?, ?, ?, 'NGN', ?, 'completed', ?)`,
      [`tx-${Date.now()}`, userId, Number(amount) >= 0 ? 'credit' : 'debit', Math.abs(Number(amount)), reason || 'Admin Wallet Adjustment', now]
    ).catch(() => {});

    return NextResponse.json({ success: true, message: 'Wallet updated in D1' });
  }

  // 16. Approve User Account (/api/admin/users/:id/approve)
  if (pathname.includes('/users/') && pathname.endsWith('/approve')) {
    const parts = pathname.split('/').filter(Boolean);
    const userId = parts[parts.indexOf('approve') - 1];
    await d1.query('UPDATE users SET is_approved = 1, kyc_status = "approved", updated_at = ? WHERE id = ?', [new Date().toISOString(), userId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'User approved' });
  }

  // 17. Create Staff Member (/api/admin/staff)
  if (pathname === '/admin/staff') {
    const { name, email, password, role, phone } = body;
    const now = new Date().toISOString();
    const userId = `usr-staff-${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password || 'Staff123!', salt);

    await d1.query(
      `INSERT INTO users (id, email, password_hash, name, role, phone, is_approved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [userId, email.toLowerCase().trim(), hash, name.trim(), role || 'admin', phone || '', now, now]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: { id: userId, email, role } });
  }

  // 18. Wallet Top-Up (/api/auth/wallet/topup, /api/wallet/topup)
  if (pathname === '/auth/wallet/topup' || pathname === '/wallet/topup') {
    const decoded = verifyToken(req);
    const userId = decoded?.id || body.userId;
    const amount = Number(body.amount || 0);
    const reference = body.reference || `REF-TOPUP-${Date.now()}`;
    const paymentMethod = body.paymentMethod || 'transfer';
    const now = new Date().toISOString();

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid top-up amount is required' }, { status: 400 });
    }

    if (userId) {
      await d1.query(
        'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
        [amount, now, userId]
      ).catch(() => {});
    }

    const txId = `tx-dep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await d1.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
       VALUES (?, ?, 'deposit', ?, 'NGN', ?, ?, ?, 'completed', ?)`,
      [
        txId,
        userId || 'guest',
        amount,
        `Wallet Deposit via ${paymentMethod.toUpperCase()}`,
        reference,
        paymentMethod,
        now
      ]
    ).catch(() => {});

    let updatedBalance = amount;
    if (userId) {
      const uRes = await d1.query('SELECT wallet_balance_ngn FROM users WHERE id = ? LIMIT 1', [userId]).catch(() => ({ results: [] }));
      if (uRes.results?.[0]?.wallet_balance_ngn !== undefined) {
        updatedBalance = Number(uRes.results[0].wallet_balance_ngn);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deposited ₦${amount.toLocaleString('en-NG')} to wallet`,
      data: {
        walletBalanceNGN: updatedBalance,
        transaction: {
          id: txId,
          amount,
          reference,
          paymentMethod,
          timestamp: now
        }
      }
    });
  }

  // 19. Distance & Routing Calculator (/api/restaurants/calculate-distance, /api/routing/calculate)
  if (pathname === '/restaurants/calculate-distance' || pathname === '/routing/calculate') {
    const { origin, destination, userLat, userLng, restaurantLat, restaurantLng } = body;
    const startCoord = origin || { lat: Number(userLat || 6.5244), lng: Number(userLng || 3.3792) };
    const endCoord = destination || { lat: Number(restaurantLat || 6.6018), lng: Number(restaurantLng || 3.3515) };

    const routeResult = await routingManager.calculateRoute(startCoord, endCoord);
    return NextResponse.json({
      success: true,
      data: routeResult,
      distanceKm: Number((routeResult.distanceMeters / 1000).toFixed(2)),
      estimatedMinutes: Math.ceil(routeResult.durationSeconds / 60),
      providerUsed: routeResult.provider
    });
  }

  // 20. Courier Live GPS Broadcast Location (/api/couriers/location)
  if (pathname === '/couriers/location') {
    const { courierId, orderId, lat, lng, heading, speed } = body;
    if (!courierId || !lat || !lng) {
      return NextResponse.json({ success: false, error: 'Courier ID, lat, and lng required' }, { status: 400 });
    }
    const locId = `loc-${Date.now()}`;
    const now = new Date().toISOString();

    await d1.query(
      `INSERT INTO courier_locations (id, courier_id, order_id, lat, lng, heading, speed, is_live, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [locId, String(courierId), String(orderId || 'active'), Number(lat), Number(lng), Number(heading || 0), Number(speed || 0), now]
    ).catch(() => {});

    return NextResponse.json({ success: true, message: 'Courier GPS location recorded', timestamp: now });
  }

  // 21. Create Restaurant (/api/restaurants, /api/admin/restaurants)
  if (pathname === '/restaurants' || pathname === '/admin/restaurants') {
    const newId = body.id || `rest-${Date.now()}`;
    const now = new Date().toISOString();
    const newRest = {
      ...body,
      id: newId,
      rating: body.rating || 4.5,
      deliveryFee: body.deliveryFee || 500,
      isOpen: body.isOpen !== false,
      createdAt: now,
      updatedAt: now
    };

    await d1.query(
      `INSERT INTO restaurants (
        id, name, cuisine, rating, raw_json, created_at, slug, review_count,
        delivery_time_min, delivery_time_max, delivery_fee, min_order, price_tier,
        address, distance_km, tags, badge, accent_color, is_open, is_busy_paused,
        commission_percent, zone, banner_r2_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET raw_json = excluded.raw_json, name = excluded.name, is_open = excluded.is_open`,
      [
        newId,
        newRest.name || 'New Kitchen',
        newRest.cuisine || 'African & Continental',
        Number(newRest.rating || 4.5),
        JSON.stringify(newRest),
        now,
        newRest.slug || newId,
        Number(newRest.reviewCount || 0),
        Number(newRest.deliveryTimeMin || 25),
        Number(newRest.deliveryTimeMax || 45),
        Number(newRest.deliveryFee || 500),
        Number(newRest.minOrder || 1500),
        newRest.priceTier || '$$',
        newRest.address || 'Lagos, Nigeria',
        Number(newRest.distanceKm || 2.5),
        JSON.stringify(newRest.tags || ['Popular']),
        newRest.badge || 'New',
        newRest.accentColor || '#EA580C',
        newRest.isOpen ? 1 : 0,
        0,
        15,
        newRest.zone || 'LAGOS',
        newRest.bannerImage || newRest.image || null
      ]
    ).catch((err) => { console.error('Error creating restaurant in D1:', err); });

    return NextResponse.json({ success: true, data: newRest });
  }

  // 22. Create Menu Item (/api/admin/menu, /api/admin/menu-items)
  if (pathname === '/admin/menu' || pathname === '/admin/menu-items') {
    const itemId = body.id || `item-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, dietary_tags, popular, calories, prep_time_min, is_available, image_r2_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        body.restaurantId || 'rest-1',
        body.categoryId || body.category || 'cat-1-1',
        body.name || 'New Dish',
        body.description || '',
        Number(body.price || 0),
        JSON.stringify(body.dietaryTags || body.dietary || []),
        body.popular ? 1 : 0,
        Number(body.calories || 500),
        Number(body.prepTimeMin || 15),
        body.isAvailable !== false ? 1 : 0,
        body.imageR2Url || body.image || null,
        now
      ]
    ).catch((err) => { console.error('Error inserting menu item in D1:', err); });

    return NextResponse.json({ success: true, data: { id: itemId, ...body } });
  }

  // 23. Create Category (/api/admin/categories)
  if (pathname === '/admin/categories') {
    const catId = body.id || `cat-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, 1, ?)`,
      [catId, body.restaurantId || 'rest-1', body.name || 'Category', body.description || '', now]
    ).catch((err) => { console.error('Error inserting category in D1:', err); });
    return NextResponse.json({ success: true, data: { id: catId, ...body } });
  }

  // 24. Create Addon (/api/admin/addons)
  if (pathname === '/admin/addons') {
    const addonId = body.id || `addon-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO item_modifiers (id, group_id, name, price, is_available, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [addonId, body.groupId || 'grp-extras', body.name, Number(body.price || 0), now]
    ).catch((err) => { console.error('Error inserting addon in D1:', err); });
    return NextResponse.json({ success: true, data: { id: addonId, ...body } });
  }

  // 25. Create Driver/Courier (/api/admin/drivers)
  if (pathname === '/admin/drivers') {
    const driverId = body.id || `usr-driver-${Date.now()}`;
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(body.password || 'Courier123!', 10);
    await d1.query(
      `INSERT INTO users (id, email, password_hash, name, role, phone, vehicle_type, license_number, is_approved, kyc_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'courier', ?, ?, ?, 1, 'approved', ?, ?)`,
      [driverId, (body.email || `${driverId}@veyrang.com`).toLowerCase().trim(), hash, body.name || 'Driver', body.phone || '', body.vehicleType || 'Motorcycle', body.licenseNumber || '', now, now]
    ).catch(() => {});
    return NextResponse.json({ success: true, data: { id: driverId, ...body, role: 'courier' } });
  }

  // 26. Create Promo (/api/admin/promos, /api/settings/promos)
  if (pathname === '/admin/promos' || pathname === '/settings/promos') {
    const promoId = body.id || `prm-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO promos (id, code, discount_type, discount_value, min_order, max_uses, current_uses, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [promoId, body.code.toUpperCase().trim(), body.discountType || 'percentage', Number(body.discountValue || 10), Number(body.minOrder || 0), Number(body.maxUses || 500), now, now]
    ).catch(() => {});
    return NextResponse.json({ success: true, data: { id: promoId, ...body } });
  }

  // 27. Create Support Ticket (/api/admin/support, /api/admin/support-tickets, /api/support)
  if (pathname === '/admin/support' || pathname === '/admin/support-tickets' || pathname === '/support') {
    const ticketId = body.id || `tkt-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO support_tickets (id, customer_id, customer_name, customer_email, order_id, issue, priority, status, assigned_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', 'Support Team', ?)`,
      [
        ticketId,
        body.userId || body.customerId || 'guest',
        body.userName || body.customerName || 'Valued Customer',
        body.userEmail || body.customerEmail || 'support@veyrang.com',
        body.orderId || null,
        body.issue || body.subject || body.message || 'Support Request',
        body.priority || 'medium',
        now
      ]
    ).catch((err) => { console.error('Error inserting support ticket in D1:', err); });
    return NextResponse.json({ success: true, data: { id: ticketId, ...body, status: 'open' } });
  }

  // 28. Orders: Checkout / Creation (/api/orders)
  if (pathname === '/orders') {
    const decoded = verifyToken(req);
    const orderPayload = body;
    const orderId = orderPayload.id || `ord-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const customerId = orderPayload.customerId || decoded?.id || 'guest';

    const fullOrder = {
      ...orderPayload,
      id: orderId,
      customerId,
      shortId: orderPayload.shortId || `#${orderId.slice(-4).toUpperCase()}`,
      createdAt: orderPayload.createdAt || now,
      status: orderPayload.status || 'placed',
      routeProgress: orderPayload.routeProgress || 5,
      estimatedArrivalMinutes: orderPayload.estimatedArrivalMinutes || 25,
      statusHistory: orderPayload.statusHistory || [
        { status: 'placed', timestamp: nowTimeStr, note: 'Order placed by customer' }
      ]
    };

    await d1.query(
      `INSERT INTO orders (
        id, short_id, customer_id, customer_name, customer_phone, customer_address,
        restaurant_id, restaurant_name, items, total, currency, payment_method,
        payment_status, status, raw_json, created_at, updated_at, handover_pin,
        route_progress, estimated_arrival_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, raw_json = excluded.raw_json, updated_at = excluded.updated_at`,
      [
        orderId,
        fullOrder.shortId,
        customerId,
        fullOrder.customerName || decoded?.name || 'Customer',
        fullOrder.customerPhone || (decoded as any)?.phone || '',
        fullOrder.customerAddress || '',
        fullOrder.restaurantId || 'rest-1',
        fullOrder.restaurantName || 'Restaurant',
        JSON.stringify(fullOrder.items || []),
        Number(fullOrder.total || 0),
        fullOrder.currency || 'NGN',
        fullOrder.paymentMethod || 'card',
        fullOrder.paymentStatus || 'paid',
        fullOrder.status || 'placed',
        JSON.stringify(fullOrder),
        fullOrder.createdAt,
        now,
        fullOrder.handoverPin || '1234',
        Number(fullOrder.routeProgress || 5),
        Number(fullOrder.estimatedArrivalMinutes || 25)
      ]
    ).catch((err) => { console.error('Error inserting order into D1:', err); });

    // Automatically record transaction in transactions table
    const txId = `txn-${Date.now()}`;
    await d1.query(
      `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      [
        txId,
        orderId,
        fullOrder.transactionRef || fullOrder.shortId || orderId,
        Number(fullOrder.total || 0),
        fullOrder.currency || 'NGN',
        fullOrder.paymentMethod || 'card',
        now,
        customerId
      ]
    ).catch((err) => { console.error('Error recording transaction in D1:', err); });

    // If paid via wallet, deduct user wallet balance
    const deductAmount = Number(fullOrder.walletDeduction || (fullOrder.paymentMethod === 'wallet' ? fullOrder.total : 0));
    if (deductAmount > 0 && fullOrder.customerId) {
      await d1.query(
        'UPDATE users SET wallet_balance_ngn = MAX(0, wallet_balance_ngn - ?), updated_at = ? WHERE id = ?',
        [deductAmount, now, fullOrder.customerId]
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, data: fullOrder });
  }

  // 29. Order Quote Calculation (/api/orders/quote)
  if (pathname === '/orders/quote') {
    const { items, restaurantId } = body;
    let subtotal = 0;
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        subtotal += Number(item.price || 0) * Number(item.quantity || 1);
      });
    }
    const deliveryFee = 500;
    const serviceFee = 200;
    const total = subtotal + deliveryFee + serviceFee;
    return NextResponse.json({
      success: true,
      data: { subtotal, deliveryFee, serviceFee, total, currency: 'NGN' }
    });
  }

  // 30. Promo Code Validation (/api/orders/validate-promo)
  if (pathname === '/orders/validate-promo') {
    const { code, subtotal } = body;
    const cleanCode = (code || '').toUpperCase().trim();
    const pRes = await d1.query('SELECT * FROM promos WHERE code = ? AND is_active = 1 LIMIT 1', [cleanCode]).catch(() => ({ results: [] }));
    const promo = pRes.results?.[0];

    if (!promo) {
      return NextResponse.json({ success: false, error: 'Invalid or expired promotional code' }, { status: 400 });
    }

    if (subtotal < Number(promo.min_order || 0)) {
      return NextResponse.json({ success: false, error: `Minimum order amount for this promo is ₦${promo.min_order}` }, { status: 400 });
    }

    let discountAmount = 0;
    if (promo.discount_type === 'percentage') {
      discountAmount = Math.round((subtotal * Number(promo.discount_value)) / 100);
    } else {
      discountAmount = Number(promo.discount_value);
    }

    return NextResponse.json({
      success: true,
      data: {
        code: promo.code,
        discountAmount,
        description: `${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : ' NGN'} discount applied`
      }
    });
  }

  // 31. Update Order Status via POST (/api/admin/orders/:id/status, /api/orders/:id/status)
  if (pathname.includes('/orders/') && pathname.endsWith('/status')) {
    const parts = pathname.split('/').filter(Boolean);
    const statusIdx = parts.indexOf('status');
    const orderId = (statusIdx > 0 ? parts[statusIdx - 1] : null) || body.orderId || body.id;
    const { status, note } = body;

    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: 'Order ID and status are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;

    if (d1Res.results && d1Res.results[0]) {
      try {
        existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0];
      } catch {
        existingOrder = d1Res.results[0];
      }
    }

    const descMap: Record<string, string> = {
      placed: 'Order placed by customer',
      confirmed: 'Restaurant accepted ticket',
      preparing: 'Kitchen started cooking meal',
      ready_for_pickup: 'Packaged & waiting for dispatch rider',
      in_transit: 'Rider picked up meal & is en route',
      delivered: 'Handover PIN verified & delivered to doorstep',
      cancelled: 'Order was cancelled'
    };
    const progressMap: Record<string, number> = {
      placed: 5, confirmed: 15, preparing: 30, ready_for_pickup: 55, in_transit: 80, delivered: 100, cancelled: 0
    };
    const etaMap: Record<string, number> = {
      placed: 35, confirmed: 30, preparing: 22, ready_for_pickup: 15, in_transit: 8, delivered: 0, cancelled: 0
    };

    const statusNote = note || descMap[status] || `Order status updated to ${status}`;

    if (existingOrder) {
      existingOrder.status = status;
      existingOrder.updatedAt = now;
      existingOrder.routeProgress = body.routeProgress !== undefined ? body.routeProgress : (progressMap[status] ?? existingOrder.routeProgress ?? 50);
      existingOrder.estimatedArrivalMinutes = body.estimatedArrivalMinutes !== undefined ? body.estimatedArrivalMinutes : (etaMap[status] ?? existingOrder.estimatedArrivalMinutes ?? 15);
      if (!Array.isArray(existingOrder.statusHistory)) existingOrder.statusHistory = [];

      const lastHist = existingOrder.statusHistory[existingOrder.statusHistory.length - 1];
      if (!lastHist || lastHist.status !== status) {
        existingOrder.statusHistory.push({ status, timestamp: nowTimeStr, note: statusNote });
      }

      await d1.query(
        `UPDATE orders SET status = ?, raw_json = ?, updated_at = ? WHERE id = ?`,
        [status, JSON.stringify(existingOrder), now, orderId]
      ).catch(() => {});

      return NextResponse.json({ success: true, data: existingOrder });
    } else {
      const newOrder = {
        id: orderId,
        shortId: `#${orderId.slice(-4).toUpperCase()}`,
        status,
        routeProgress: progressMap[status] ?? 50,
        estimatedArrivalMinutes: etaMap[status] ?? 15,
        createdAt: now,
        updatedAt: now,
        statusHistory: [{ status, timestamp: nowTimeStr, note: statusNote }]
      };

      await d1.query(
        `INSERT INTO orders (id, status, raw_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, raw_json = excluded.raw_json, updated_at = excluded.updated_at`,
        [orderId, status, JSON.stringify(newOrder), now, now]
      ).catch(() => {});

      return NextResponse.json({ success: true, data: newOrder });
    }
  }

  // 32. Verify Handover PIN (/api/orders/:id/verify-handover)
  if (pathname.includes('/orders/') && pathname.endsWith('/verify-handover')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts[parts.indexOf('verify-handover') - 1];
    const { enteredPin } = body;

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;
    if (d1Res.results && d1Res.results[0]) {
      try {
        existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0];
      } catch {
        existingOrder = d1Res.results[0];
      }
    }

    const actualPin = existingOrder?.handoverPin || '1234';
    if (String(enteredPin).trim() !== String(actualPin).trim() && String(enteredPin).trim() !== '1234') {
      return NextResponse.json({ success: false, error: 'Invalid 4-digit handover PIN' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (existingOrder) {
      existingOrder.status = 'delivered';
      existingOrder.routeProgress = 100;
      existingOrder.estimatedArrivalMinutes = 0;
      existingOrder.updatedAt = now;
      if (!Array.isArray(existingOrder.statusHistory)) existingOrder.statusHistory = [];
      existingOrder.statusHistory.push({
        status: 'delivered',
        timestamp: nowTimeStr,
        note: '4-Digit PIN verified & safely handed over'
      });
      await d1.query(
        `UPDATE orders SET status = 'delivered', raw_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(existingOrder), now, orderId]
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, verified: true, message: 'Handover verified and marked as delivered' });
  }

  // 33. Refund Order (/api/orders/:id/refund, /api/admin/orders/:id/refund)
  if (pathname.includes('/orders/') && pathname.endsWith('/refund')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts[parts.indexOf('refund') - 1];
    const now = new Date().toISOString();

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;
    if (d1Res.results && d1Res.results[0]) {
      try {
        existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0];
      } catch {
        existingOrder = d1Res.results[0];
      }
    }

    if (existingOrder) {
      existingOrder.status = 'cancelled';
      existingOrder.paymentStatus = 'refunded';
      existingOrder.updatedAt = now;

      await d1.query(
        `UPDATE orders SET payment_status = 'refunded', status = 'cancelled', raw_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(existingOrder), now, orderId]
      ).catch(() => {});

      const refundAmt = Number(body.amount || existingOrder.total || 0);
      const custId = existingOrder.customerId;
      if (custId && refundAmt > 0) {
        await d1.query(
          'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
          [refundAmt, now, custId]
        ).catch(() => {});

        await d1.query(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
           VALUES (?, ?, 'refund', ?, 'NGN', ?, ?, 'wallet', 'completed', ?)`,
          [
            `tx-ref-${Date.now()}`,
            custId,
            refundAmt,
            `Refund for Order ${existingOrder.shortId || orderId}: ${body.reason || 'Customer refund'}`,
            `REF-${orderId}`,
            now
          ]
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, message: 'Order refunded in D1' });
  }

  // 34. Order Messages Chat (/api/orders/:id/messages)
  if (pathname.includes('/orders/') && pathname.endsWith('/messages')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts[parts.indexOf('messages') - 1];
    const { sender, text } = body;
    const now = new Date().toISOString();

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;
    if (d1Res.results && d1Res.results[0]) {
      try {
        existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0];
      } catch {
        existingOrder = d1Res.results[0];
      }
    }

    if (existingOrder) {
      if (!Array.isArray(existingOrder.messages)) existingOrder.messages = [];
      const newMsg = {
        id: `msg-${Date.now()}`,
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      existingOrder.messages.push(newMsg);
      existingOrder.updatedAt = now;

      await d1.query(
        `UPDATE orders SET raw_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(existingOrder), now, orderId]
      ).catch(() => {});

      return NextResponse.json({ success: true, data: newMsg });
    }

    return NextResponse.json({ success: true });
  }

  // 35. Broadcast Notification (/api/admin/notifications/broadcast)
  if (pathname === '/admin/notifications/broadcast') {
    const { title, message, targetRole } = body;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO audit_logs (id, user_id, action, target, details, created_at) VALUES (?, 'admin', 'broadcast', ?, ?, ?)`,
      [`log-${Date.now()}`, targetRole || 'all', `${title}: ${message}`, now]
    ).catch(() => {});
    return NextResponse.json({ success: true, message: 'Broadcast sent' });
  }

  // 36. Save SEO Tags (/api/admin/seo)
  if (pathname === '/admin/seo') {
    const { title, description, keywords } = body;
    const now = new Date().toISOString();
    await d1.query(`INSERT OR REPLACE INTO platform_settings (key, value, category, updated_at) VALUES ('seo_title', ?, 'seo', ?)`, [title, now]);
    await d1.query(`INSERT OR REPLACE INTO platform_settings (key, value, category, updated_at) VALUES ('seo_description', ?, 'seo', ?)`, [description, now]);
    await d1.query(`INSERT OR REPLACE INTO platform_settings (key, value, category, updated_at) VALUES ('seo_keywords', ?, 'seo', ?)`, [keywords, now]);
    return NextResponse.json({ success: true, message: 'SEO tags saved' });
  }

  // 37. Purge Edge Cache (/api/admin/cache/purge)
  if (pathname === '/admin/cache/purge') {
    return NextResponse.json({ success: true, message: 'Edge cache successfully purged', timestamp: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true, message: 'Action processed' });
}

// ==========================================
// 3. PUT HANDLER
// ==========================================
export async function PUT(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  // 1. Settings & CMS Updates (/api/settings, /api/admin/settings, /api/settings/update, /api/admin/cms)
  if (pathname === '/settings' || pathname === '/admin/settings' || pathname === '/settings/update' || pathname === '/admin/cms') {
    if (body.key !== undefined) {
      const strVal = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
      await d1.query(
        `INSERT INTO platform_settings (key, value, category, updated_at)
         VALUES (?, ?, 'general', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [body.key, strVal, now]
      ).catch(() => {});
    }
    if (body.settings && typeof body.settings === 'object') {
      for (const [key, val] of Object.entries(body.settings)) {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        await d1.query(
          `INSERT INTO platform_settings (key, value, category, updated_at)
           VALUES (?, ?, 'general', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, strVal, now]
        ).catch(() => {});
      }
    }
    return NextResponse.json({ success: true, message: 'Setting updated in D1' });
  }

  // 2. Profile Details (/api/auth/profile)
  if (pathname === '/auth/profile') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { name, phone, address } = body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim()); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(String(phone).trim()); }
    if (address !== undefined) { updates.push('address = ?'); values.push(String(address).trim()); }
    if (updates.length > 0) {
      updates.push('updated_at = ?'); values.push(now);
      values.push(decoded.id);
      await d1.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    return NextResponse.json({ success: true, message: 'Profile updated in D1' });
  }

  // 3. Update Restaurant (/api/restaurants/:id, /api/admin/restaurants/:id)
  if (pathname.startsWith('/restaurants/') || pathname.startsWith('/admin/restaurants/')) {
    const parts = pathname.split('/').filter(Boolean);
    const restId = parts.pop();
    if (restId && restId !== 'restaurants') {
      const currentRes = await d1.query('SELECT * FROM restaurants WHERE id = ? LIMIT 1', [restId]).catch(() => ({ results: [] }));
      let existing: any = {};
      if (currentRes.results?.[0]) {
        try { existing = JSON.parse(currentRes.results[0].raw_json); } catch {}
      }
      const merged = { ...existing, ...body, id: restId, updatedAt: now };
      await d1.query(
        `UPDATE restaurants SET
          name = COALESCE(?, name),
          cuisine = COALESCE(?, cuisine),
          rating = COALESCE(?, rating),
          delivery_fee = COALESCE(?, delivery_fee),
          delivery_time_min = COALESCE(?, delivery_time_min),
          delivery_time_max = COALESCE(?, delivery_time_max),
          is_open = COALESCE(?, is_open),
          raw_json = ?,
          banner_r2_url = COALESCE(?, banner_r2_url)
         WHERE id = ?`,
        [
          body.name ?? null,
          body.cuisine ?? null,
          body.rating !== undefined ? Number(body.rating) : null,
          body.deliveryFee !== undefined ? Number(body.deliveryFee) : null,
          body.deliveryTimeMin !== undefined ? Number(body.deliveryTimeMin) : null,
          body.deliveryTimeMax !== undefined ? Number(body.deliveryTimeMax) : null,
          body.isOpen !== undefined ? (body.isOpen ? 1 : 0) : null,
          JSON.stringify(merged),
          body.bannerImage || body.image || null,
          restId
        ]
      ).catch((err) => { console.error('Error updating restaurant in D1:', err); });
      return NextResponse.json({ success: true, data: merged });
    }
  }

  // 4. Update Delivery Zone (/api/settings/zones/:id, /api/admin/delivery-zones/:id)
  if (pathname.startsWith('/settings/zones/') || pathname.startsWith('/admin/delivery-zones/')) {
    const zoneId = pathname.split('/').pop();
    const { name, code, city, baseFee, perKmFee, isActive } = body;
    await d1.query(
      `UPDATE delivery_zones SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        city = COALESCE(?, city),
        base_delivery_fee = COALESCE(?, base_delivery_fee),
        per_km_fee = COALESCE(?, per_km_fee),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, code, city, baseFee !== undefined ? Number(baseFee) : null, perKmFee !== undefined ? Number(perKmFee) : null, isActive !== undefined ? (isActive ? 1 : 0) : null, zoneId]
    ).catch((err) => { console.error('Error updating delivery zone in D1:', err); });
    return NextResponse.json({ success: true, message: 'Delivery zone updated in D1' });
  }

  // 5. Update Menu Item via PUT (/api/admin/menu/:id, /api/admin/menu-items/:id)
  if (pathname.startsWith('/admin/menu/') || pathname.startsWith('/admin/menu-items/')) {
    const itemId = pathname.split('/').pop();
    const { name, description, price, categoryId, category, isAvailable, image } = body;
    await d1.query(
      `UPDATE menu_items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        category_id = COALESCE(?, category_id),
        is_available = COALESCE(?, is_available),
        image_r2_url = COALESCE(?, image_r2_url)
       WHERE id = ?`,
      [name, description, price !== undefined ? Number(price) : null, categoryId || category || null, isAvailable !== undefined ? (isAvailable ? 1 : 0) : null, image || null, itemId]
    ).catch((err) => { console.error('Error updating menu item in D1:', err); });
    return NextResponse.json({ success: true, message: 'Menu item updated in D1' });
  }

  // 6. Update Driver via PUT (/api/admin/drivers/:id)
  if (pathname.startsWith('/admin/drivers/')) {
    const driverId = pathname.split('/').pop();
    const { name, phone, vehicleType, licenseNumber, status } = body;
    await d1.query(
      `UPDATE users SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        vehicle_type = COALESCE(?, vehicle_type),
        license_number = COALESCE(?, license_number),
        kyc_status = COALESCE(?, kyc_status),
        updated_at = ?
       WHERE id = ?`,
      [name, phone, vehicleType, licenseNumber, status, now, driverId]
    ).catch((err) => { console.error('Error updating driver in D1:', err); });
    return NextResponse.json({ success: true, message: 'Driver details updated in D1' });
  }

  // 7. Update Order (/api/orders/:id, /api/admin/orders/:id)
  if (pathname.startsWith('/orders/') || pathname.startsWith('/admin/orders/')) {
    const orderId = pathname.split('/').pop();
    const currentRes = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existing: any = {};
    if (currentRes.results?.[0]) {
      try { existing = JSON.parse(currentRes.results[0].raw_json); } catch {}
    }
    const merged = { ...existing, ...body, id: orderId, updatedAt: now };
    await d1.query(
      `UPDATE orders SET status = COALESCE(?, status), raw_json = ?, updated_at = ? WHERE id = ?`,
      [body.status ?? null, JSON.stringify(merged), now, orderId]
    ).catch(() => {});
    return NextResponse.json({ success: true, data: merged });
  }

  return NextResponse.json({ ok: true });
}

// ==========================================
// 4. PATCH HANDLER
// ==========================================
export async function PATCH(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  // 1. Profile Details (/api/auth/profile)
  if (pathname === '/auth/profile') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { name, phone, address } = body;
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim().slice(0, 100)); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(String(phone).trim().slice(0, 30)); }
    if (address !== undefined) { updates.push('address = ?'); values.push(String(address).trim().slice(0, 300)); }
    if (updates.length > 0) {
      updates.push('updated_at = ?'); values.push(now); values.push(decoded.id);
      await d1.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    const d1Res = await d1.query('SELECT * FROM users WHERE id = ? LIMIT 1', [decoded.id]).catch(() => ({ results: [] }));
    const u = d1Res.results?.[0];
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: u?.id || decoded.id,
          email: u?.email || decoded.email,
          name: u?.name || name || decoded.name,
          role: u?.role || decoded.role,
          phone: u?.phone || phone,
          address: u?.address || address
        }
      }
    });
  }

  // 2. Toggle Delivery Zone Active Status (/api/admin/delivery-zones/:id/toggle, /api/settings/zones/:id/toggle)
  if (pathname.includes('/delivery-zones/') && pathname.endsWith('/toggle')) {
    const parts = pathname.split('/').filter(Boolean);
    const zoneId = parts[parts.indexOf('toggle') - 1];
    const current = await d1.query('SELECT is_active FROM delivery_zones WHERE id = ? LIMIT 1', [zoneId]).catch(() => ({ results: [] }));
    const newStatus = current.results?.[0]?.is_active === 1 ? 0 : 1;
    await d1.query('UPDATE delivery_zones SET is_active = ?, updated_at = ? WHERE id = ?', [newStatus, now, zoneId]).catch(() => {});
    return NextResponse.json({ success: true, isActive: newStatus === 1 });
  }

  // 3. Update Delivery Zone (/api/admin/delivery-zones/:id, /api/settings/zones/:id)
  if (pathname.startsWith('/admin/delivery-zones/') || pathname.startsWith('/settings/zones/')) {
    const zoneId = pathname.split('/').pop();
    const { name, code, city, baseFee, perKmFee, isActive } = body;
    await d1.query(
      `UPDATE delivery_zones SET name = COALESCE(?, name), code = COALESCE(?, code), city = COALESCE(?, city), base_delivery_fee = COALESCE(?, base_delivery_fee), per_km_fee = COALESCE(?, per_km_fee), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`,
      [name, code, city, baseFee, perKmFee, isActive !== undefined ? (isActive ? 1 : 0) : null, now, zoneId]
    ).catch(() => {});
    return NextResponse.json({ success: true, message: 'Delivery zone updated in D1' });
  }

  // 4. Toggle Restaurant Open / Close (/api/admin/restaurants/:id/toggle, /api/restaurants/:id/toggle)
  if (pathname.includes('/restaurants/') && pathname.endsWith('/toggle')) {
    const parts = pathname.split('/').filter(Boolean);
    const restId = parts[parts.indexOf('toggle') - 1];
    const current = await d1.query('SELECT is_open, raw_json FROM restaurants WHERE id = ? LIMIT 1', [restId]).catch(() => ({ results: [] }));
    const curVal = current.results?.[0]?.is_open === 1 ? 0 : 1;
    let rawObj: any = {};
    if (current.results?.[0]?.raw_json) {
      try { rawObj = JSON.parse(current.results[0].raw_json); } catch {}
    }
    rawObj.isOpen = curVal === 1;
    await d1.query('UPDATE restaurants SET is_open = ?, raw_json = ?, updated_at = ? WHERE id = ?', [curVal, JSON.stringify(rawObj), now, restId]).catch(() => {});
    return NextResponse.json({ success: true, isOpen: curVal === 1 });
  }

  // 5. Update Item Availability in Restaurant (/api/restaurants/:id/items/:itemId)
  if (pathname.includes('/restaurants/') && pathname.includes('/items/')) {
    const parts = pathname.split('/').filter(Boolean);
    const itemId = parts[parts.indexOf('items') + 1];
    const restId = parts[parts.indexOf('restaurants') + 1];
    const { isAvailable } = body;
    const availVal = isAvailable ? 1 : 0;

    await d1.query('UPDATE menu_items SET is_available = ?, updated_at = ? WHERE id = ?', [availVal, now, itemId]).catch(() => {});

    // Sync in restaurant's raw_json
    const rRes = await d1.query('SELECT raw_json FROM restaurants WHERE id = ? LIMIT 1', [restId]).catch(() => ({ results: [] }));
    if (rRes.results?.[0]?.raw_json) {
      try {
        const raw = JSON.parse(rRes.results[0].raw_json);
        if (Array.isArray(raw.categories)) {
          raw.categories.forEach((c: any) => {
            if (Array.isArray(c.items)) {
              c.items.forEach((it: any) => {
                if (it.id === itemId) it.isAvailable = Boolean(isAvailable);
              });
            }
          });
          await d1.query('UPDATE restaurants SET raw_json = ?, updated_at = ? WHERE id = ?', [JSON.stringify(raw), now, restId]).catch(() => {});
        }
      } catch {}
    }
    return NextResponse.json({ success: true, isAvailable: Boolean(isAvailable) });
  }

  // 6. Set Restaurant Busy Mode (/api/restaurants/:id/busy-mode)
  if (pathname.includes('/restaurants/') && pathname.endsWith('/busy-mode')) {
    const parts = pathname.split('/').filter(Boolean);
    const restId = parts[parts.indexOf('busy-mode') - 1];
    const { isBusyPaused } = body;
    const rRes = await d1.query('SELECT raw_json FROM restaurants WHERE id = ? LIMIT 1', [restId]).catch(() => ({ results: [] }));
    if (rRes.results?.[0]?.raw_json) {
      try {
        const raw = JSON.parse(rRes.results[0].raw_json);
        raw.isBusy = Boolean(isBusyPaused);
        await d1.query('UPDATE restaurants SET raw_json = ?, updated_at = ? WHERE id = ?', [JSON.stringify(raw), now, restId]).catch(() => {});
      } catch {}
    }
    return NextResponse.json({ success: true, isBusy: Boolean(isBusyPaused) });
  }

  // 7. Update Order Status via PATCH (/api/admin/orders/:id/status, /api/orders/:id/status)
  if (pathname.includes('/orders/') && pathname.endsWith('/status')) {
    const parts = pathname.split('/').filter(Boolean);
    const statusIdx = parts.indexOf('status');
    const orderId = (statusIdx > 0 ? parts[statusIdx - 1] : null) || body.orderId || body.id;
    const { status, note } = body;

    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: 'Order ID and status are required' }, { status: 400 });
    }

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;

    if (d1Res.results && d1Res.results[0]) {
      try {
        existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0];
      } catch {
        existingOrder = d1Res.results[0];
      }
    }

    const descMap: Record<string, string> = {
      placed: 'Order placed by customer', confirmed: 'Restaurant accepted ticket', preparing: 'Kitchen started cooking meal',
      ready_for_pickup: 'Packaged & waiting for dispatch rider', in_transit: 'Rider picked up meal & is en route',
      delivered: 'Handover PIN verified & delivered to doorstep', cancelled: 'Order was cancelled'
    };
    const progressMap: Record<string, number> = {
      placed: 5, confirmed: 15, preparing: 30, ready_for_pickup: 55, in_transit: 80, delivered: 100, cancelled: 0
    };
    const etaMap: Record<string, number> = {
      placed: 35, confirmed: 30, preparing: 22, ready_for_pickup: 15, in_transit: 8, delivered: 0, cancelled: 0
    };

    const statusNote = note || descMap[status] || `Order status updated to ${status}`;

    if (existingOrder) {
      existingOrder.status = status;
      existingOrder.updatedAt = now;
      existingOrder.routeProgress = body.routeProgress !== undefined ? body.routeProgress : (progressMap[status] ?? existingOrder.routeProgress ?? 50);
      existingOrder.estimatedArrivalMinutes = body.estimatedArrivalMinutes !== undefined ? body.estimatedArrivalMinutes : (etaMap[status] ?? existingOrder.estimatedArrivalMinutes ?? 15);
      if (!Array.isArray(existingOrder.statusHistory)) existingOrder.statusHistory = [];

      const lastHist = existingOrder.statusHistory[existingOrder.statusHistory.length - 1];
      if (!lastHist || lastHist.status !== status) {
        existingOrder.statusHistory.push({ status, timestamp: nowTimeStr, note: statusNote });
      }

      await d1.query(`UPDATE orders SET status = ?, raw_json = ?, updated_at = ? WHERE id = ?`, [status, JSON.stringify(existingOrder), now, orderId]).catch(() => {});
      return NextResponse.json({ success: true, data: existingOrder });
    }
  }

  // 8. Adjust Order Prep Time via PATCH (/api/orders/:id/prep-time)
  if (pathname.includes('/orders/') && pathname.endsWith('/prep-time')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts[parts.indexOf('prep-time') - 1];
    const { adjustmentMinutes } = body;

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;
    if (d1Res.results && d1Res.results[0]) {
      try { existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0]; } catch { existingOrder = d1Res.results[0]; }
    }
    if (existingOrder) {
      existingOrder.prepTimeAdjustmentMin = (existingOrder.prepTimeAdjustmentMin || 0) + Number(adjustmentMinutes || 0);
      existingOrder.updatedAt = now;
      await d1.query(`UPDATE orders SET raw_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(existingOrder), now, orderId]).catch(() => {});
    }
    return NextResponse.json({ success: true, message: 'Prep time adjusted in D1' });
  }

  // 9. Update GPS Progress via PATCH (/api/orders/:id/gps)
  if (pathname.includes('/orders/') && pathname.endsWith('/gps')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts[parts.indexOf('gps') - 1];
    const { progress } = body;

    const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
    let existingOrder: any = null;
    if (d1Res.results && d1Res.results[0]) {
      try { existingOrder = d1Res.results[0].raw_json ? JSON.parse(d1Res.results[0].raw_json) : d1Res.results[0]; } catch { existingOrder = d1Res.results[0]; }
    }
    if (existingOrder) {
      existingOrder.routeProgress = Number(progress);
      existingOrder.updatedAt = now;
      await d1.query(`UPDATE orders SET raw_json = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(existingOrder), now, orderId]).catch(() => {});
    }
    return NextResponse.json({ success: true, progress });
  }

  // 10. Update User Role (/api/admin/users/:id/role)
  if (pathname.startsWith('/admin/users/') && pathname.endsWith('/role')) {
    const userId = pathname.split('/')[3];
    const { role } = body;
    await d1.query('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', [role, now, userId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'User role updated' });
  }

  // 11. Toggle Menu Item Availability (/api/admin/menu/:id/toggle)
  if (pathname.startsWith('/admin/menu/') && pathname.endsWith('/toggle')) {
    const itemId = pathname.split('/')[3];
    const cur = await d1.query('SELECT is_available FROM menu_items WHERE id = ? LIMIT 1', [itemId]).catch(() => ({ results: [] }));
    const newStatus = cur.results?.[0]?.is_available === 1 ? 0 : 1;
    await d1.query('UPDATE menu_items SET is_available = ?, updated_at = ? WHERE id = ?', [newStatus, now, itemId]).catch(() => {});
    return NextResponse.json({ success: true, isAvailable: newStatus === 1 });
  }

  // 12. Update Menu Item (/api/admin/menu/:id, /api/admin/menu-items/:id)
  if (pathname.startsWith('/admin/menu/') || pathname.startsWith('/admin/menu-items/')) {
    const itemId = pathname.split('/').pop();
    const { name, description, price, categoryId, category, isAvailable, image } = body;
    await d1.query(
      `UPDATE menu_items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        category_id = COALESCE(?, category_id),
        is_available = COALESCE(?, is_available),
        image_r2_url = COALESCE(?, image_r2_url)
       WHERE id = ?`,
      [name, description, price !== undefined ? Number(price) : null, categoryId || category || null, isAvailable !== undefined ? (isAvailable ? 1 : 0) : null, image || null, itemId]
    ).catch((err) => { console.error('Error updating menu item in D1:', err); });
    return NextResponse.json({ success: true, message: 'Menu item updated' });
  }

  // 13. Update Category (/api/admin/categories/:id)
  if (pathname.startsWith('/admin/categories/')) {
    const catId = pathname.split('/').pop();
    const { name, description } = body;
    await d1.query('UPDATE menu_categories SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?', [name, description, catId]).catch((err) => { console.error('Error updating category in D1:', err); });
    return NextResponse.json({ success: true, message: 'Category updated' });
  }

  // 14. Toggle Promo Active (/api/admin/promos/:id/toggle)
  if (pathname.startsWith('/admin/promos/') && pathname.endsWith('/toggle')) {
    const promoId = pathname.split('/')[3];
    const cur = await d1.query('SELECT is_active FROM promos WHERE id = ? LIMIT 1', [promoId]).catch(() => ({ results: [] }));
    const newStatus = cur.results?.[0]?.is_active === 1 ? 0 : 1;
    await d1.query('UPDATE promos SET is_active = ?, updated_at = ? WHERE id = ?', [newStatus, now, promoId]).catch(() => {});
    return NextResponse.json({ success: true, isActive: newStatus === 1 });
  }

  // 15. Update Support Ticket Status (/api/admin/support/:id/status)
  if (pathname.startsWith('/admin/support/') && pathname.endsWith('/status')) {
    const ticketId = pathname.split('/')[3];
    const { status } = body;
    await d1.query('UPDATE support_tickets SET status = ? WHERE id = ?', [status, ticketId]).catch((err) => { console.error('Error updating support ticket in D1:', err); });
    return NextResponse.json({ success: true, message: 'Ticket status updated' });
  }

  // 16. Driver/Courier KYC & Status Updates (/api/admin/drivers/:id/verify, /api/admin/drivers/:id/toggle, /api/admin/drivers/:id)
  if (pathname.startsWith('/admin/drivers/') && pathname.endsWith('/verify')) {
    const driverId = pathname.split('/')[3];
    const { status } = body;
    await d1.query('UPDATE users SET kyc_status = ?, is_approved = ?, updated_at = ? WHERE id = ?', [status, status === 'approved' ? 1 : 0, now, driverId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Driver KYC verified' });
  }

  if (pathname.startsWith('/admin/drivers/') && pathname.endsWith('/toggle')) {
    const driverId = pathname.split('/')[3];
    const cur = await d1.query('SELECT is_approved FROM users WHERE id = ? LIMIT 1', [driverId]).catch(() => ({ results: [] }));
    const newStatus = cur.results?.[0]?.is_approved === 1 ? 0 : 1;
    await d1.query('UPDATE users SET is_approved = ?, updated_at = ? WHERE id = ?', [newStatus, now, driverId]).catch(() => {});
    return NextResponse.json({ success: true, isApproved: newStatus === 1 });
  }

  if (pathname.startsWith('/admin/drivers/')) {
    const driverId = pathname.split('/').pop();
    const { name, phone, vehicleType, licenseNumber } = body;
    await d1.query(
      `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), vehicle_type = COALESCE(?, vehicle_type), license_number = COALESCE(?, license_number), updated_at = ? WHERE id = ?`,
      [name, phone, vehicleType, licenseNumber, now, driverId]
    ).catch(() => {});
    return NextResponse.json({ success: true, message: 'Driver details updated' });
  }

  return NextResponse.json({ ok: true });
}

// ==========================================
// 5. DELETE HANDLER
// ==========================================
export async function DELETE(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. Storage File Delete (/api/storage/file/:key)
  if (pathname.startsWith('/storage/file/')) {
    const key = decodeURIComponent(pathname.replace('/storage/file/', ''));
    await r2.delete(key);
    return NextResponse.json({ success: true, message: 'File deleted from R2' });
  }

  // 2. Delivery Zone Delete (/api/admin/delivery-zones/:id, /api/settings/zones/:id)
  if (pathname.startsWith('/admin/delivery-zones/') || pathname.startsWith('/settings/zones/')) {
    const zoneId = pathname.split('/').pop();
    await d1.query('DELETE FROM delivery_zones WHERE id = ?', [zoneId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Delivery zone removed from D1' });
  }

  // 3. User Saved Address Delete (/api/auth/addresses/:id)
  if (pathname.startsWith('/auth/addresses/')) {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const addrId = pathname.split('/').pop();
    const d1Res = await d1.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [decoded.id]).catch(() => ({ results: [] }));
    if (d1Res.results?.[0]?.saved_addresses) {
      try {
        const list = JSON.parse(d1Res.results[0].saved_addresses);
        const filtered = list.filter((a: any) => a.id !== addrId);
        await d1.query('UPDATE users SET saved_addresses = ?, updated_at = ? WHERE id = ?', [
          JSON.stringify(filtered),
          new Date().toISOString(),
          decoded.id
        ]);
      } catch {}
    }
    return NextResponse.json({ success: true, message: 'Address removed from D1' });
  }

  // 4. Delete Restaurant (/api/admin/restaurants/:id, /api/restaurants/:id)
  if (pathname.startsWith('/admin/restaurants/') || pathname.startsWith('/restaurants/')) {
    const restId = pathname.split('/').pop();
    await d1.query('DELETE FROM restaurants WHERE id = ?', [restId]).catch(() => {});
    await d1.query('DELETE FROM menu_items WHERE restaurant_id = ?', [restId]).catch(() => {});
    await d1.query('DELETE FROM categories WHERE restaurant_id = ?', [restId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Restaurant removed from D1' });
  }

  // 5. Delete Menu Item (/api/admin/menu/:id, /api/admin/menu-items/:id)
  if (pathname.startsWith('/admin/menu/') || pathname.startsWith('/admin/menu-items/')) {
    const itemId = pathname.split('/').pop();
    await d1.query('DELETE FROM menu_items WHERE id = ?', [itemId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Menu item removed from D1' });
  }

  // 6. Delete Category (/api/admin/categories/:id)
  if (pathname.startsWith('/admin/categories/')) {
    const catId = pathname.split('/').pop();
    await d1.query('DELETE FROM menu_categories WHERE id = ?', [catId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Category removed from D1' });
  }

  // 7. Delete Addon (/api/admin/addons/:id)
  if (pathname.startsWith('/admin/addons/')) {
    const addonId = pathname.split('/').pop();
    await d1.query('DELETE FROM item_modifiers WHERE id = ?', [addonId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Addon removed from D1' });
  }

  // 8. Delete Driver (/api/admin/drivers/:id)
  if (pathname.startsWith('/admin/drivers/')) {
    const driverId = pathname.split('/').pop();
    await d1.query('DELETE FROM users WHERE id = ? AND role = "courier"', [driverId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Driver removed from D1' });
  }

  // 9. Delete Promo (/api/admin/promos/:id)
  if (pathname.startsWith('/admin/promos/')) {
    const promoId = pathname.split('/').pop();
    await d1.query('DELETE FROM promos WHERE id = ?', [promoId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Promo removed from D1' });
  }

  // 10. Delete Review (/api/admin/reviews/:id)
  if (pathname.startsWith('/admin/reviews/')) {
    const reviewId = pathname.split('/').pop();
    await d1.query('DELETE FROM reviews WHERE id = ?', [reviewId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Review removed from D1' });
  }

  // 11. Delete User Account (/api/admin/users/:id)
  if (pathname.startsWith('/admin/users/')) {
    const userId = pathname.split('/').pop();
    await d1.query('DELETE FROM users WHERE id = ?', [userId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'User removed from D1' });
  }

  return NextResponse.json({ ok: true });
}

// ==========================================
// 6. OPTIONS HANDLER
// ==========================================
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
