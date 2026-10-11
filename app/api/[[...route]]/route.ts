import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1';
import { r2 } from '../../../lib/r2';
import { siteDataManager, PUBLIC_SETTINGS_WHITELIST } from '../../../lib/siteDataSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();

function verifyToken(req: NextRequest): any | null {
  if (!JWT_SECRET) return null;
  try {
    const authHeader = req.headers.get('authorization');
    const rawToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies.get('veyrang_jwt_token')?.value ||
        req.cookies.get('veyrang_token')?.value ||
        req.cookies.get('veyrang_auth_token')?.value ||
        req.cookies.get('token')?.value ||
        req.cookies.get('auth_token')?.value;
    const token = (rawToken || '').trim();
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
      'SELECT id, email, role, name, phone, address, restaurant_id, wallet_balance_ngn, wallet_balance_usd, saved_addresses, is_approved FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [decoded.id, decoded.email || '']
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
      role: u.role || decoded.role || 'customer',
      name: u.name || decoded.name || 'User',
      phone: u.phone || '',
      address: u.address || '',
      restaurantId: u.restaurant_id || undefined,
      isApproved: u.is_approved !== 0,
      walletBalanceNGN: Number(u.wallet_balance_ngn || 0),
      walletBalanceUSD: Number(u.wallet_balance_usd || 0),
      savedAddresses
    };
  }
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role || 'customer',
    name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'User'),
    phone: '',
    address: '',
    isApproved: true,
    walletBalanceNGN: 0,
    walletBalanceUSD: 0,
    savedAddresses: []
  };
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin === 'https://veyrang.com' ||
    origin === 'https://www.veyrang.com' ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
}

export async function GET(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  if (pathname === '/' || pathname === '/health') {
    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (pathname === '/health/d1') {
    const healthUser = await getUser(req);
    if (!healthUser || (healthUser.role !== 'admin' && healthUser.role !== 'sub_admin')) {
      return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    try {
      await d1.query('SELECT 1 as live_status');
      return NextResponse.json({ success: true, connected: true, checkedAt: new Date().toISOString() });
    } catch (err: any) {
      return NextResponse.json({ success: false, connected: false, error: err?.message || 'D1 error' }, { status: 503 });
    }
  }

  if (pathname === '/storage/status') {
    const storageUser = await getUser(req);
    if (!storageUser || (storageUser.role !== 'admin' && storageUser.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ success: true, r2: r2.getDetails() });
  }

  if (pathname === '/site-data/public' || pathname === '/restaurants') {
    const snapshot = await siteDataManager.servePublicCatalogue();
    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: 'Catalogue is warming up. Please retry.', data: null },
        { status: 503 }
      );
    }
    if (pathname === '/restaurants') {
      return NextResponse.json({ success: true, data: snapshot.restaurants || [] });
    }
    return NextResponse.json({
      success: true,
      data: {
        version: snapshot.version,
        updatedAt: snapshot.updatedAt,
        restaurants: snapshot.restaurants || [],
        deliveryZones: snapshot.deliveryZones || [],
        promoCodes: snapshot.promoCodes || [],
        platformSettings: snapshot.platformSettings || {}
      }
    });
  }

  if (pathname === '/settings') {
    const user = await getUser(req);
    const isAdmin = user && (user.role === 'admin' || user.role === 'sub_admin');
    let d1Res: any = { results: [] };
    try {
      d1Res = await d1.query('SELECT key, value FROM platform_settings');
    } catch {}
    const settingsMap: Record<string, any> = {};
    for (const row of d1Res.results || []) {
      if (!isAdmin && !PUBLIC_SETTINGS_WHITELIST.has(row.key)) continue;
      try {
        settingsMap[row.key] = JSON.parse(row.value);
      } catch {
        settingsMap[row.key] = row.value;
      }
    }
    return NextResponse.json({ success: true, data: settingsMap, settings: settingsMap });
  }

  if (pathname === '/auth/me') {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    return NextResponse.json({ success: true, data: { user } });
  }

  return NextResponse.json({ success: false, error: `Route not found: ${pathname}` }, { status: 404 });
}

export async function POST(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (pathname === '/auth/login') {
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }
    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    const user = d1Res.results?.[0];
    if (!user || !user.password_hash) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }
    if (!JWT_SECRET) {
      return NextResponse.json({ success: false, error: 'Server auth is not configured' }, { status: 503 });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const res = NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone || '',
          restaurantId: user.restaurant_id || undefined
        }
      }
    });
    res.cookies.set('veyrang_jwt_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    return res;
  }

  return NextResponse.json({ success: false, error: `Route not found: ${pathname}` }, { status: 404 });
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function PATCH() {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
  if (isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin!;
  }
  return new Response(null, { status: 204, headers });
}
