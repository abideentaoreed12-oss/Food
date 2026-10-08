import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1';
import { r2 } from '../../../lib/r2';
import { paymentGateway } from '../../../lib/payment';

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

  if (pathname === '/' || pathname === '/health') {
    return NextResponse.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { d1: true, r2: r2.isConfigured(), routing: true },
      version: '2.6.0'
    });
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
    const d1Res = await d1
      .query('SELECT key, value FROM platform_settings')
      .catch(() => ({ results: [] as any[] }));
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
    const d1Res = await d1
      .query(
        'SELECT * FROM delivery_zones WHERE is_active = 1 OR is_active IS NULL ORDER BY created_at DESC'
      )
      .catch(() => ({ results: [] as any[] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/restaurants' || pathname === '/admin/restaurants') {
    const d1Res = await d1
      .query('SELECT * FROM restaurants ORDER BY rating DESC')
      .catch(() => ({ results: [] as any[] }));
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
      ? await d1
          .query('SELECT * FROM orders ORDER BY created_at DESC')
          .catch(() => ({ results: [] as any[] }))
      : await d1
          .query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [user.id])
          .catch(() => ({ results: [] as any[] }));
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

  if (pathname === '/admin/users') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const d1Res = await d1
      .query(
        'SELECT id, email, name, role, phone, address, wallet_balance_ngn, wallet_balance_usd, created_at FROM users ORDER BY created_at DESC'
      )
      .catch(() => ({ results: [] as any[] }));
    return NextResponse.json({ success: true, data: d1Res.results || [] });
  }

  if (pathname === '/admin/overview') {
    const user = await getUser(req);
    if (!user || (user.role !== 'admin' && user.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const users = await d1
      .query('SELECT count(*) as c FROM users')
      .catch(() => ({ results: [{ c: 0 }] }));
    const orders = await d1
      .query('SELECT count(*) as c, sum(total) as gmv FROM orders')
      .catch(() => ({ results: [{ c: 0, gmv: 0 }] }));
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
  return POST(req);
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
