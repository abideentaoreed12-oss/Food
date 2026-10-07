import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1.ts';
import { r2 } from '../../../lib/r2.ts';
import { routingManager } from '../../../lib/routingManager.ts';
import { INITIAL_RESTAURANTS } from '../../../src/data/mockData.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-production-secret-key-2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'abideentaoreed12@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Teeplus1029';

// Auto-ensure D1 database tables are bootstrapped
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

export async function GET(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. Health Audit Endpoints
  if (pathname === '/' || pathname === '/health') {
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }

  // Admin Auth Guard for all GET /admin/* endpoints
  if (pathname.startsWith('/admin')) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

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

  if (pathname === '/health/r2') {
    return NextResponse.json({
      success: true,
      r2Connected: r2.isConfigured(),
      details: r2.getDetails(),
      timestamp: new Date().toISOString()
    });
  }

  // Routing Manager Health Endpoint (/api/routing/health)
  if (pathname === '/routing/health' || pathname === '/admin/routing/health') {
    return NextResponse.json({
      success: true,
      health: routingManager.getHealth(),
      timestamp: new Date().toISOString()
    });
  }

  // Order Live GPS Courier Location Tracking (/api/orders/:id/tracking or /api/tracking/:orderId)
  if (pathname.includes('/tracking')) {
    const parts = pathname.split('/').filter(Boolean);
    const orderId = parts.find((p) => p !== 'orders' && p !== 'tracking' && p !== 'api') || 'active';

    const locRes = await d1.query(
      `SELECT * FROM courier_locations WHERE order_id = ? OR order_id = 'active' ORDER BY updated_at DESC LIMIT 1`,
      [orderId]
    ).catch(() => ({ results: [] }));

    const latestLoc = locRes.results?.[0] || null;
    const isLive = latestLoc ? (Date.now() - new Date(latestLoc.updated_at).getTime()) < 120000 : false;

    return NextResponse.json({
      success: true,
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

  // 2. Auth: Get Current User Profile (/api/auth/me)
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

  // 3. Platform Settings & CMS Content
  if (pathname === '/settings' || pathname === '/admin/settings') {
    const decoded = verifyToken(req);
    const isAdmin = decoded && (decoded.role === 'admin' || decoded.email === ADMIN_EMAIL);

    if (pathname === '/admin/settings' && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

  // 4. Delivery Zones
  if (pathname === '/settings/zones' || pathname === '/admin/delivery-zones') {
    const d1Res = await d1.query('SELECT * FROM delivery_zones ORDER BY created_at DESC').catch(() => ({ results: [] }));
    let zones = d1Res.results || [];

    if (zones.length === 0) {
      const initialZones = [
        { id: 'zone-1', name: 'Downtown Core (Metropolitan Area)', code: 'LEKKI', city: 'Lagos', country: 'Nigeria', currency: 'NGN', base_delivery_fee: 500, per_km_fee: 150, is_active: 1 },
        { id: 'zone-2', name: 'Victoria Island / Ikoyi Financial Hub', code: 'VI', city: 'Lagos', country: 'Nigeria', currency: 'NGN', base_delivery_fee: 800, per_km_fee: 200, is_active: 1 },
        { id: 'zone-3', name: 'Ikeja GRA / Mainland Hub', code: 'IKEJA', city: 'Lagos', country: 'Nigeria', currency: 'NGN', base_delivery_fee: 600, per_km_fee: 180, is_active: 1 }
      ];
      for (const iz of initialZones) {
        await d1.query(
          `INSERT INTO delivery_zones (id, name, code, city, country, currency, base_delivery_fee, per_km_fee, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          [iz.id, iz.name, iz.code, iz.city, iz.country, iz.currency, iz.base_delivery_fee, iz.per_km_fee, iz.is_active, new Date().toISOString(), new Date().toISOString()]
        ).catch(() => {});
      }
      zones = initialZones;
    }

    return NextResponse.json({ success: true, data: zones });
  }

  // 5. Live Restaurants
  if (pathname === '/restaurants' || pathname === '/admin/restaurants') {
    const d1Res = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC').catch(() => ({ results: [] }));
    if (d1Res.results && d1Res.results.length > 0) {
      const parsed = d1Res.results.map((r: any) => {
        try {
          return r.raw_json ? JSON.parse(r.raw_json) : r;
        } catch {
          return r;
        }
      });
      return NextResponse.json({ success: true, data: parsed });
    }
    return NextResponse.json({ success: true, data: INITIAL_RESTAURANTS });
  }

  // 6. Orders
  if (pathname === '/orders' || pathname === '/admin/orders') {
    const decoded = verifyToken(req);
    let query = 'SELECT * FROM orders ORDER BY created_at DESC';
    let params: any[] = [];

    if (decoded && decoded.role === 'customer') {
      query = 'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC';
      params = [decoded.id];
    }

    const d1Res = await d1.query(query, params).catch(() => ({ results: [] }));
    const orders = (d1Res.results || []).map((o: any) => {
      try {
        return o.raw_json ? JSON.parse(o.raw_json) : o;
      } catch {
        return o;
      }
    });
    return NextResponse.json({ success: true, data: orders });
  }

  // 7. Users
  if (pathname === '/admin/users') {
    const d1Res = await d1.query('SELECT id, email, name, role, phone, address, wallet_balance_ngn, wallet_balance_usd, created_at FROM users ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 8. Menu Items
  if (pathname === '/admin/menu' || pathname === '/admin/menu-items') {
    const d1Res = await d1.query('SELECT * FROM menu_items ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 9. Categories & Addons
  if (pathname === '/admin/categories') {
    const d1Res = await d1.query('SELECT * FROM categories ORDER BY name ASC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/admin/addons') {
    const d1Res = await d1.query('SELECT * FROM addons ORDER BY name ASC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 10. Drivers / Couriers
  if (pathname === '/admin/drivers') {
    const d1Res = await d1.query("SELECT * FROM users WHERE role = 'courier' ORDER BY created_at DESC").catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 11. Promos
  if (pathname === '/admin/promos' || pathname === '/settings/promos') {
    const d1Res = await d1.query('SELECT * FROM promos ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 12. Reviews
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

  // 13. Support Tickets
  if (pathname === '/admin/support' || pathname === '/admin/support-tickets') {
    const d1Res = await d1.query('SELECT * FROM support_tickets ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 14. Transactions & Audit Logs
  if (pathname === '/admin/transactions') {
    const d1Res = await d1.query('SELECT * FROM wallet_transactions ORDER BY created_at DESC').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/admin/audit-logs') {
    const d1Res = await d1.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').catch(() => ({ results: [] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  // 15. Admin Dashboard Overview
  if (pathname === '/admin/overview') {
    const [uRes, oRes, rRes, zRes] = await Promise.all([
      d1.query('SELECT COUNT(*) as count FROM users'),
      d1.query('SELECT COUNT(*) as count, SUM(total_amount) as total_revenue FROM orders'),
      d1.query('SELECT COUNT(*) as count FROM restaurants'),
      d1.query('SELECT COUNT(*) as count FROM delivery_zones')
    ]).catch(() => [ { results: [{ count: 0 }] }, { results: [{ count: 0, total_revenue: 0 }] }, { results: [{ count: 0 }] }, { results: [{ count: 0 }] } ]);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: uRes.results?.[0]?.count || 0,
        totalOrders: oRes.results?.[0]?.count || 0,
        totalRevenueNGN: oRes.results?.[0]?.total_revenue || 0,
        totalRestaurants: rRes.results?.[0]?.count || 0,
        totalDeliveryZones: zRes.results?.[0]?.count || 0,
        d1Status: d1.getDetails()
      }
    });
  }

  // 16. Saved Addresses
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

  return NextResponse.json({ ok: true, path: req.nextUrl.pathname });
}

export async function POST(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  if (pathname.startsWith('/admin')) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 1. Cloudflare R2 Asset Upload (/api/storage/upload)
  if (pathname === '/storage/upload') {
    const { key, dataBase64, contentType } = body;
    if (!key || !dataBase64) {
      return NextResponse.json({ success: false, error: 'Missing key or base64 image data' }, { status: 400 });
    }

    const uploadRes = await r2.upload(key, dataBase64, contentType || 'image/jpeg');
    return NextResponse.json({
      success: uploadRes.success,
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
          `INSERT INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
           VALUES (?, ?, ?, 'System Administrator', 'admin', '+234 800 000 0000', 'Lagos, Nigeria', 0, 0, '[]', ?, ?)
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

  // 3. User Registration (/api/auth/register)
  if (pathname === '/auth/register') {
    const { email, password, name, phone, address } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]).catch(() => ({ results: [] }));
    if (existing.results && existing.results.length > 0) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const now = new Date().toISOString();
    const userId = `usr-${Date.now()}`;

    await d1.query(
      `INSERT INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '[]', ?, ?)`,
      [userId, cleanEmail, passwordHash, name.trim(), 'customer', phone || '', address || '', now, now]
    );

    const newUser = {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      role: 'customer',
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

  // 4. User Logout (/api/auth/logout)
  if (pathname === '/auth/logout') {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('veyrang_token', '', { maxAge: 0 });
    return response;
  }

  // 5. Developer SQL Console (/api/admin/developer/query, /api/admin/query)
  if (pathname === '/admin/developer/query' || pathname === '/admin/query') {
    const { sql, params } = body;
    if (!sql) {
      return NextResponse.json({ success: false, error: 'Missing SQL statement' }, { status: 400 });
    }
    const res = await d1.query(sql, params || []);
    return NextResponse.json({ success: res.success, data: res.results || [], meta: res.meta || {} });
  }

  // 6. Ping Database
  if (pathname === '/health/d1/ping') {
    const pingRes = await d1.ping();
    return NextResponse.json({ success: pingRes.connected, latencyMs: pingRes.latencyMs, error: pingRes.error || null });
  }

  // 7. Save Address (/api/auth/addresses)
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

  // 8. Admin Create Delivery Zone (/api/admin/delivery-zones)
  if (pathname === '/admin/delivery-zones') {
    const { name, code, city, country, currency, baseFee, perKmFee, radiusKm, surgeMultiplier, centerLat, centerLng, mapImageR2Url } = body;
    const newId = `zone-${Date.now()}`;
    const now = new Date().toISOString();
    await d1.query(
      `INSERT INTO delivery_zones (id, name, code, city, country, currency, base_delivery_fee, per_km_fee, radius_km, surge_multiplier, center_lat, center_lng, is_active, map_image_r2_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
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
        now,
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
        country: country || 'Nigeria',
        currency: currency || 'NGN',
        base_delivery_fee: Number(baseFee || 500),
        per_km_fee: Number(perKmFee || 150),
        is_active: 1
      }
    });
  }

  // 9. Admin Settings & CMS Bulk Update
  if (pathname === '/admin/settings/bulk-update' || pathname === '/settings/bulk-update' || pathname === '/settings/bulk' || pathname === '/settings/update') {
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

  // 10. Submit Customer Review (/api/reviews)
  if (pathname === '/reviews') {
    const { orderId, restaurantId, courierId, customerName, foodRating, deliveryRating, comment, photoR2Url } = body;
    const revId = `rev-${Date.now()}`;
    const now = new Date().toISOString();

    await d1.query(
      `INSERT INTO reviews (id, order_id, restaurant_id, courier_id, customer_name, food_rating, delivery_rating, comment, photo_r2_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [revId, orderId || 'order-direct', restaurantId || 'rest-1', courierId || null, customerName || 'Valued Customer', Number(foodRating || 5), Number(deliveryRating || 5), comment || '', photoR2Url || null, now]
    ).catch(() => {});

    return NextResponse.json({ success: true, data: { id: revId, photoR2Url } });
  }

  // 11. Adjust User Wallet
  if (pathname.includes('/users/') && pathname.endsWith('/wallet')) {
    const userId = pathname.split('/')[3];
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

  // 12. Calculate Distance & Routing Provider Engine (/api/restaurants/calculate-distance, /api/routing/calculate)
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

  // 13. Courier Live GPS Broadcast Location Endpoint (/api/couriers/location)
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

  return NextResponse.json({ ok: true, message: 'Action processed' });
}

export async function PUT(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  if (pathname.startsWith('/admin')) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (pathname === '/settings/update' || pathname === '/admin/cms') {
    const { key, value } = body;
    const now = new Date().toISOString();
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    await d1.query(
      `INSERT INTO platform_settings (key, value, category, updated_at)
       VALUES (?, ?, 'general', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, strVal, now]
    ).catch(() => {});
    return NextResponse.json({ success: true, message: 'Setting updated in D1' });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  if (pathname.startsWith('/admin')) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 1. Update Profile Details (/api/auth/profile)
  if (pathname === '/auth/profile') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { name, phone, address } = body;
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(String(name).trim().slice(0, 100));
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(String(phone).trim().slice(0, 30));
    }
    if (address !== undefined) {
      updates.push('address = ?');
      values.push(String(address).trim().slice(0, 300));
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(decoded.id);

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

  // 2. Admin Toggle Delivery Zone Active Status (/api/admin/delivery-zones/[id]/toggle)
  if (pathname.includes('/delivery-zones/') && pathname.endsWith('/toggle')) {
    const parts = pathname.split('/');
    const zoneId = parts[3] || parts[parts.length - 2];
    const current = await d1.query('SELECT is_active FROM delivery_zones WHERE id = ? LIMIT 1', [zoneId]).catch(() => ({ results: [] }));
    const newStatus = current.results?.[0]?.is_active === 1 ? 0 : 1;
    await d1.query('UPDATE delivery_zones SET is_active = ?, updated_at = ? WHERE id = ?', [newStatus, new Date().toISOString(), zoneId]).catch(() => {});
    return NextResponse.json({ success: true, isActive: newStatus === 1 });
  }

  // 3. Admin Update Delivery Zone (/api/admin/delivery-zones/[id])
  if (pathname.startsWith('/admin/delivery-zones/')) {
    const zoneId = pathname.split('/').pop();
    const { name, code, city, baseFee, perKmFee, isActive } = body;
    await d1.query(
      `UPDATE delivery_zones SET name = COALESCE(?, name), code = COALESCE(?, code), city = COALESCE(?, city), base_delivery_fee = COALESCE(?, base_delivery_fee), per_km_fee = COALESCE(?, per_km_fee), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`,
      [name, code, city, baseFee, perKmFee, isActive !== undefined ? (isActive ? 1 : 0) : null, new Date().toISOString(), zoneId]
    ).catch(() => {});
    return NextResponse.json({ success: true, message: 'Delivery zone updated in D1' });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureD1Schema();
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  if (pathname.startsWith('/admin')) {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 1. Storage File Delete (/api/storage/file/[key])
  if (pathname.startsWith('/storage/file/')) {
    const key = decodeURIComponent(pathname.replace('/storage/file/', ''));
    await r2.delete(key);
    return NextResponse.json({ success: true, message: 'File deleted from R2' });
  }

  // 2. Admin Delete Delivery Zone (/api/admin/delivery-zones/[id])
  if (pathname.startsWith('/admin/delivery-zones/')) {
    const zoneId = pathname.split('/').pop();
    await d1.query('DELETE FROM delivery_zones WHERE id = ?', [zoneId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Delivery zone removed from D1' });
  }

  // 3. User Delete Address (/api/auth/addresses/[id])
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

  return NextResponse.json({ ok: true });
}

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
