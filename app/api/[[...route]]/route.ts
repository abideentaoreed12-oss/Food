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

const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-super-secure-production-jwt-key-2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'abideentaoreed12@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Teeplus1029';

// Disposable Email Domains Blocklist
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'example.com', 'test.com', 'mailinator.com', 'yopmail.com',
  'tempmail.com', 'trashmail.com', 'dispostable.com', 'guerrillamail.com',
  'sharklasers.com', '10minutemail.com', 'fakeinbox.com', 'getnada.com',
  'throwawaymail.com', 'inboxalias.com'
]);

function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes('@')) return true;
  const domain = email.toLowerCase().trim().split('@').pop() || '';
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  if (domain.endsWith('.example.com') || domain.endsWith('.test.com')) return true;
  return false;
}

// Login & OTP In-Memory Rate Limiters
const loginFailures = new Map<string, { count: number; lastAttempt: number }>();
const otpRequests = new Map<string, { count: number; lastRequest: number }>();

function checkLoginRateLimit(key: string): boolean {
  const record = loginFailures.get(key);
  if (!record) return true;
  if (Date.now() - record.lastAttempt > 15 * 60 * 1000) {
    loginFailures.delete(key);
    return true;
  }
  return record.count < 5;
}

function recordLoginFailure(key: string) {
  const record = loginFailures.get(key) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  loginFailures.set(key, record);
}

function resetLoginFailures(key: string) {
  loginFailures.delete(key);
}

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
        sort_order INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS item_modifiers (
        id TEXT PRIMARY KEY,
        group_id TEXT,
        name TEXT,
        price REAL DEFAULT 0,
        is_available INTEGER DEFAULT 1,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS item_modifier_groups (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT,
        name TEXT,
        required INTEGER DEFAULT 0,
        created_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS promos (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        discount_type TEXT,
        discount_value REAL,
        min_order REAL DEFAULT 0,
        max_uses INTEGER DEFAULT 500,
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

async function getAuthenticatedUserD1(req: NextRequest): Promise<{ id: string; email: string; role: string; name: string; phone?: string; address?: string } | null> {
  const decoded = verifyToken(req);
  if (!decoded) return null;
  const d1Res = await d1.query('SELECT id, email, role, name, phone, address FROM users WHERE id = ? LIMIT 1', [decoded.id]).catch(() => ({ results: [] }));
  if (d1Res.results && d1Res.results[0]) {
    const u = d1Res.results[0];
    return { id: u.id, email: u.email, role: u.role || 'customer', name: u.name, phone: u.phone || '', address: u.address || '' };
  }
  if (decoded.email === ADMIN_EMAIL) {
    return { id: decoded.id, email: decoded.email, role: 'admin', name: decoded.name || 'Admin', phone: (decoded as any).phone || '', address: (decoded as any).address || '' };
  }
  return decoded as any;
}

// ==========================================
// 1. GET HANDLER
// ==========================================
export async function GET(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. System Health Check & Status (Public, Clean, No Infrastructure Keys)
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

  // 2. Cloudflare D1 SQL Connectivity Check (Auth + Admin Role Required)
  if (pathname === '/health/d1' || pathname === '/health/d1/ping') {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const pingRes = await d1.ping();
    const tablesRes = await d1.query("SELECT name FROM sqlite_master WHERE type='table'").catch(() => ({ results: [] }));
    return NextResponse.json({
      success: pingRes.connected,
      d1Connected: pingRes.connected,
      latencyMs: pingRes.latencyMs,
      tablesCount: tablesRes.results?.length || 0,
      timestamp: new Date().toISOString()
    });
  }

  // 3. Cloudflare R2 Connectivity Check (Auth + Admin Role Required)
  if (pathname === '/health/r2') {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({
      success: true,
      r2Connected: r2.isConfigured(),
      timestamp: new Date().toISOString()
    });
  }

  // 4. Geolocation & Routing Health Check (Auth + Admin Role Required)
  if (pathname === '/routing/health' || pathname === '/admin/routing/health') {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({
      success: true,
      health: routingManager.getHealth(),
      timestamp: new Date().toISOString()
    });
  }

  // 5. Live GPS Courier Location Tracking (/api/orders/:id/tracking)
  if (pathname.includes('/tracking')) {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
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
        } : null
      }
    });
  }

  // 6. Current User Session (/api/auth/me)
  if (pathname === '/auth/me') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const d1Res = await d1.query('SELECT * FROM users WHERE id = ? LIMIT 1', [user.id]).catch(() => ({ results: [] }));
    if (d1Res.results && d1Res.results[0]) {
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
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role || 'customer',
          walletBalanceUSD: 0,
          walletBalanceNGN: 0,
          savedAddresses: []
        }
      }
    });
  }

  // Admin Auth Guard for sensitive GET /admin/* endpoints
  if (pathname.startsWith('/admin')) {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
  }

  // 7. Platform Settings (/api/settings, /api/admin/settings)
  if (pathname === '/settings' || pathname === '/admin/settings') {
    const user = await getAuthenticatedUserD1(req);
    const isAdmin = user && (user.role === 'admin' || user.role === 'sub_admin');

    const d1Res = await d1.query('SELECT key, value, category, description FROM platform_settings').catch(() => ({ results: [] }));
    const settingsMap: Record<string, any> = {};

    const SAFE_PUBLIC_KEYS = new Set([
      'currency_ngn_usd_rate', 'base_service_fee_ngn', 'base_service_fee_usd',
      'minimum_order_ngn', 'minimum_order_usd', 'support_phone', 'support_email',
      'maintenance_mode', 'delivery_notice'
    ]);

    if (d1Res.results && d1Res.results.length > 0) {
      d1Res.results.forEach((row: any) => {
        if (!isAdmin && !SAFE_PUBLIC_KEYS.has(row.key)) {
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

  // 8. Promo Codes Configuration (/api/settings/promos, /api/admin/promos) - Auth Required
  if (pathname === '/settings/promos' || pathname === '/admin/promos') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT id, code, discount_type, discount_value, min_order, is_active FROM promos WHERE is_active = 1').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 9. Delivery Zones (/api/settings/zones, /api/admin/delivery-zones)
  if (pathname === '/settings/zones' || pathname === '/admin/delivery-zones') {
    const d1Res = await d1.query('SELECT * FROM delivery_zones ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 10. Restaurants Catalog (/api/restaurants, /api/admin/restaurants)
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

  // 11. Orders Catalog (/api/orders, /api/admin/orders, /api/orders/:id) - REQUIRE AUTHENTICATION (Defect #1 Fix)
  if (pathname === '/orders' || pathname === '/admin/orders' || (pathname.startsWith('/orders/') && !pathname.includes('status') && !pathname.includes('verify') && !pathname.includes('refund') && !pathname.includes('messages') && !pathname.includes('tracking'))) {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const parts = pathname.split('/').filter(Boolean);
    const orderId = (parts.length === 2 && parts[0] === 'orders') ? parts[1] : null;

    if (orderId) {
      const d1Res = await d1.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]).catch(() => ({ results: [] }));
      if (d1Res.results && d1Res.results[0]) {
        const o = d1Res.results[0];
        if (user.role !== 'admin' && user.role !== 'sub_admin' && o.customer_id !== user.id) {
          return NextResponse.json({ success: false, error: 'Forbidden: Access denied' }, { status: 403 });
        }
        const parsed = o.raw_json ? JSON.parse(o.raw_json) : o;
        if (o.status) parsed.status = o.status;
        if (o.updated_at) parsed.updatedAt = o.updated_at;
        return NextResponse.json({ success: true, data: parsed });
      }
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    let query = 'SELECT * FROM orders ORDER BY created_at DESC';
    let params: any[] = [];

    if (user.role !== 'admin' && user.role !== 'sub_admin') {
      query = 'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC';
      params = [user.id];
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

  // 12. Users Management (/api/admin/users) - Admin Only
  if (pathname === '/admin/users') {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT id, email, name, role, phone, address, wallet_balance_ngn, wallet_balance_usd, is_approved, kyc_status, vehicle_type, license_number, created_at FROM users ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  return NextResponse.json({ success: false, error: 'Endpoint not found' }, { status: 404 });
}

// ==========================================
// 2. POST HANDLER
// ==========================================
export async function POST(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  // Admin Auth Guard for sensitive POST /admin/* endpoints (Defect #3 Fix)
  if (pathname.startsWith('/admin')) {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
  }

  // 1. Payment Initialization (/api/payment/initialize) - Require Auth
  if (pathname === '/payment/initialize') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { email, amount, callbackUrl, metadata } = body;
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: 'Valid payment amount is required' }, { status: 400 });
    }

    const initRes = await paymentGateway.initializePayment({
      email: email || user.email,
      amountNGN: Number(amount),
      callbackUrl,
      metadata: { ...metadata, userId: user.id }
    });

    return NextResponse.json({ success: initRes.success, data: initRes });
  }

  // 2. Payment Verification (/api/payment/verify)
  if (pathname === '/payment/verify') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { reference } = body;
    if (!reference) {
      return NextResponse.json({ success: false, error: 'Transaction reference required' }, { status: 400 });
    }

    const verifyRes = await paymentGateway.verifyPayment(reference);
    return NextResponse.json({ success: verifyRes.success, data: verifyRes });
  }

  // 3. User Login (/api/auth/login) - Rate Limited (Defect #7 Fix)
  if (pathname === '/auth/login') {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const rateLimitKey = `${ip}_${cleanEmail}`;

    if (!checkLoginRateLimit(rateLimitKey)) {
      return NextResponse.json({ success: false, error: 'Too many failed login attempts. Please wait 15 minutes.' }, { status: 429 });
    }

    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (!d1Res.results || d1Res.results.length === 0) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const u = d1Res.results[0];
    const isPasswordValid = u.password_hash ? await bcrypt.compare(password, u.password_hash) : false;

    if (!isPasswordValid) {
      recordLoginFailure(rateLimitKey);
      return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    resetLoginFailures(rateLimitKey);

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

  // 4. Send Verification Code (/api/auth/send-verification) - Disposable Email Block + Rate Limited (Defect #6 Fix)
  if (pathname === '/auth/send-verification') {
    const { email } = body;
    if (!email || isDisposableEmail(email)) {
      return NextResponse.json({ success: false, error: 'Disposable or invalid email addresses are not permitted.' }, { status: 400 });
    }
    const cleanEmail = email.toLowerCase().trim();

    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (existing.results && existing.results.length > 0) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 });
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
      message: `Verification code dispatched to ${cleanEmail}`,
      emailSent: emailRes.success
    });
  }

  // 5. User Registration (/api/auth/register) - Force 'customer' role (Defect #11 Fix)
  if (pathname === '/auth/register') {
    const { email, password, name, phone, address, code } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json({ success: false, error: 'Disposable or invalid email addresses are not permitted.' }, { status: 400 });
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
    const userRole = 'customer'; // Force customer role on self-registration

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

  // 6. Developer SQL Query (/api/admin/developer/query, /api/admin/query) - Auth + Admin Role Required (Defect #3 Fix)
  if (pathname === '/admin/developer/query' || pathname === '/admin/query') {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const { sql, params } = body;
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Missing SQL statement' }, { status: 400 });
    }
    const res = await d1.query(sql, params || []);
    return NextResponse.json({ success: res.success, data: res.results || [], meta: res.meta || {} });
  }

  // 7. Wallet Top-Up (/api/auth/wallet/topup, /api/wallet/topup) - Require Auth (Defect #9 Fix)
  if (pathname === '/auth/wallet/topup' || pathname === '/wallet/topup') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const amount = Number(body.amount || 0);
    const reference = body.reference || `REF-TOPUP-${Date.now()}`;
    const paymentMethod = body.paymentMethod || 'transfer';
    const now = new Date().toISOString();

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'Valid top-up amount is required' }, { status: 400 });
    }

    await d1.query(
      'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
      [amount, now, user.id]
    ).catch(() => {});

    const txId = `tx-dep-${Date.now()}`;
    await d1.query(
      `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
       VALUES (?, ?, 'deposit', ?, 'NGN', ?, ?, ?, 'completed', ?)`,
      [txId, user.id, amount, `Wallet Deposit via ${paymentMethod.toUpperCase()}`, reference, paymentMethod, now]
    ).catch(() => {});

    const uRes = await d1.query('SELECT wallet_balance_ngn FROM users WHERE id = ? LIMIT 1', [user.id]).catch(() => ({ results: [] }));
    const updatedBalance = Number(uRes.results?.[0]?.wallet_balance_ngn || amount);

    return NextResponse.json({
      success: true,
      message: `Successfully deposited ₦${amount.toLocaleString('en-NG')} to wallet`,
      data: {
        walletBalanceNGN: updatedBalance,
        transaction: { id: txId, amount, reference, paymentMethod, timestamp: now }
      }
    });
  }

  // 8. Order Creation / Checkout (/api/orders) - Require Auth
  if (pathname === '/orders') {
    const user = await getAuthenticatedUserD1(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const orderPayload = body;
    const orderId = orderPayload.id || `ord-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();
    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fullOrder = {
      ...orderPayload,
      id: orderId,
      customerId: user.id,
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
        user.id,
        fullOrder.customerName || user.name || 'Customer',
        fullOrder.customerPhone || user.phone || '',
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
    );

    return NextResponse.json({ success: true, data: fullOrder });
  }

  // 9. Order Refund (/api/orders/:id/refund, /api/admin/orders/:id/refund) - Require Auth & Admin Role (Defect #2 Fix)
  if (pathname.includes('/orders/') && pathname.endsWith('/refund')) {
    const user = await getAuthenticatedUserD1(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

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

  return NextResponse.json({ success: false, error: 'Endpoint not found' }, { status: 404 });
}

// ==========================================
// 3. PUT HANDLER
// ==========================================
export async function PUT(req: NextRequest) {
  await ensureD1Schema();
  const user = await getAuthenticatedUserD1(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  // Update Profile
  if (pathname === '/auth/profile' || pathname === '/auth/me') {
    const { name, phone, address } = body;
    const now = new Date().toISOString();
    await d1.query(
      'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), updated_at = ? WHERE id = ?',
      [name, phone, address, now, user.id]
    );
    return NextResponse.json({ success: true, message: 'Profile updated in D1' });
  }

  return NextResponse.json({ success: true, message: 'Updated' });
}

// ==========================================
// 4. DELETE HANDLER
// ==========================================
export async function DELETE(req: NextRequest) {
  await ensureD1Schema();
  const user = await getAuthenticatedUserD1(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  if (pathname.startsWith('/admin') && user.role !== 'admin' && user.role !== 'sub_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  return NextResponse.json({ success: true, message: 'Deleted' });
}

// ==========================================
// 5. OPTIONS HANDLER (CORS)
// ==========================================
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
