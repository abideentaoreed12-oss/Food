import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { d1 } from '../../../lib/d1.ts';
import { INITIAL_RESTAURANTS } from '../../../src/data/mockData.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-production-secret-key-2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

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
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. Health check
  if (pathname === '/' || pathname === '/health') {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // 2. Auth: Get Current User Profile (/api/auth/me)
  if (pathname === '/auth/me') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized', user: null }, { status: 401 });
    }

    // Try finding user in D1
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

    // Return decoded token identity if D1 record not present
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

  // 3. Platform Settings & CMS Content (/api/settings)
  if (pathname === '/settings' || pathname === '/admin/settings') {
    const d1Res = await d1.query('SELECT key, value, category, description FROM platform_settings');
    const settingsMap: Record<string, any> = {};

    if (d1Res.results && d1Res.results.length > 0) {
      d1Res.results.forEach((row: any) => {
        try {
          settingsMap[row.key] = JSON.parse(row.value);
        } catch {
          settingsMap[row.key] = row.value;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: settingsMap
    });
  }

  // 4. Live Restaurants (/api/restaurants)
  if (pathname === '/restaurants') {
    const d1Res = await d1.query('SELECT * FROM restaurants');
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

  // 5. Orders (/api/orders)
  if (pathname === '/orders') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: true, data: [] });
    }
    const d1Res = await d1.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [decoded.id]);
    const orders = (d1Res.results || []).map((o: any) => {
      try {
        return o.raw_json ? JSON.parse(o.raw_json) : o;
      } catch {
        return o;
      }
    });
    return NextResponse.json({ success: true, data: orders });
  }

  // 6. Saved Addresses (/api/auth/addresses)
  if (pathname === '/auth/addresses') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const d1Res = await d1.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [decoded.id]);
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
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  // 1. User & Admin Login (/api/auth/login)
  if (pathname === '/auth/login') {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if this matches configured Admin environment credentials
    if (ADMIN_EMAIL && cleanEmail === ADMIN_EMAIL && ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      const adminUser = {
        id: 'usr-admin-1',
        email: ADMIN_EMAIL,
        name: 'System Administrator',
        role: 'admin',
        phone: '+234 800 000 0000',
        walletBalanceUSD: 500,
        walletBalanceNGN: 750000,
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

    // Query Cloudflare D1 for user
    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]);
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

  // 2. User Registration (/api/auth/register)
  if (pathname === '/auth/register') {
    const { email, password, name, phone, address } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await d1.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [cleanEmail]);
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

  // 3. User Logout (/api/auth/logout)
  if (pathname === '/auth/logout') {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('veyrang_token', '', { maxAge: 0 });
    return response;
  }

  // 4. Save Address (/api/auth/addresses)
  if (pathname === '/auth/addresses') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { label, address, apartment, city, isDefault } = body;
    const d1Res = await d1.query('SELECT saved_addresses FROM users WHERE id = ? LIMIT 1', [decoded.id]);
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

  // 5. Admin Settings Bulk Update (/api/admin/settings/bulk-update or /api/admin/bulk-update)
  if (pathname === '/admin/settings/bulk-update' || pathname === '/admin/bulk-update' || pathname === '/settings/bulk-update') {
    const decoded = verifyToken(req);
    if (!decoded || (decoded.role !== 'admin' && decoded.role !== 'sub_admin')) {
      return NextResponse.json({ success: false, error: 'Admin authorization required' }, { status: 403 });
    }

    const { settings } = body;
    if (settings && typeof settings === 'object') {
      const now = new Date().toISOString();
      for (const [key, val] of Object.entries(settings)) {
        const strVal = typeof val === 'string' ? val : JSON.stringify(val);
        await d1.query(
          `INSERT INTO platform_settings (key, value, category, updated_at)
           VALUES (?, ?, 'general', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, strVal, now]
        );
      }
    }
    return NextResponse.json({ success: true, message: 'Settings updated in Cloudflare D1' });
  }

  return NextResponse.json({ ok: true, message: 'Action processed' });
}

export async function PATCH(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  // Update Profile Details (/api/auth/profile)
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

    const d1Res = await d1.query('SELECT * FROM users WHERE id = ? LIMIT 1', [decoded.id]);
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
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
