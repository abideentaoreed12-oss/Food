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

  // 3. Platform Settings & CMS Content (/api/settings, /api/admin/settings)
  if (pathname === '/settings' || pathname === '/admin/settings') {
    const d1Res = await d1.query('SELECT key, value, category, description FROM platform_settings').catch(() => ({ results: [] }));
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

  // 4. Delivery Zones (/api/settings/zones, /api/admin/delivery-zones)
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

  // 5. Live Restaurants (/api/restaurants)
  if (pathname === '/restaurants') {
    const d1Res = await d1.query('SELECT * FROM restaurants').catch(() => ({ results: [] }));
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

  // 6. Orders (/api/orders)
  if (pathname === '/orders') {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: true, data: [] });
    }
    const d1Res = await d1.query('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [decoded.id]).catch(() => ({ results: [] }));
    const orders = (d1Res.results || []).map((o: any) => {
      try {
        return o.raw_json ? JSON.parse(o.raw_json) : o;
      } catch {
        return o;
      }
    });
    return NextResponse.json({ success: true, data: orders });
  }

  // 7. Saved Addresses (/api/auth/addresses)
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
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  // 1. User & Admin Login (/api/auth/login)
  if (pathname === '/auth/login') {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

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

  // 2. User Registration (/api/auth/register)
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

  // 5. Admin Create Delivery Zone (/api/admin/delivery-zones)
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

  // 6. Admin Settings & CMS Bulk Update (/api/settings/bulk, /api/settings/update, /api/admin/settings/bulk-update)
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

  return NextResponse.json({ ok: true, message: 'Action processed' });
}

export async function PUT(req: NextRequest) {
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

  if (pathname === '/settings/update') {
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
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';
  const body = await req.json().catch(() => ({}));

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
  const pathname = req.nextUrl.pathname.replace(/^\/api/, '') || '/';

  // 1. Admin Delete Delivery Zone (/api/admin/delivery-zones/[id])
  if (pathname.startsWith('/admin/delivery-zones/')) {
    const zoneId = pathname.split('/').pop();
    await d1.query('DELETE FROM delivery_zones WHERE id = ?', [zoneId]).catch(() => {});
    return NextResponse.json({ success: true, message: 'Delivery zone removed from D1' });
  }

  // 2. User Delete Address (/api/auth/addresses/[id])
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
