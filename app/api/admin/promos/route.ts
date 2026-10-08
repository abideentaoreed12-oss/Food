import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { d1 } from '../../../../lib/d1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdmin(req: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret) as any;
    if (payload?.role !== 'admin' && payload?.role !== 'sub_admin') return null;
    return payload;
  } catch {
    return null;
  }
}

async function ensurePromoTable() {
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
  const admin = getAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  await ensurePromoTable();
  const res = await d1
    .query('SELECT * FROM promo_codes ORDER BY created_at DESC')
    .catch(() => ({ results: [] as any[] }));
  const rows = (res.results || []).map((p: any) => ({
    id: p.id,
    code: p.code,
    discountType: p.discount_type,
    discount_type: p.discount_type,
    value: Number(p.value),
    minOrderAmount: Number(p.min_order_amount || 0),
    min_order_amount: Number(p.min_order_amount || 0),
    maxDiscountCap: p.max_discount_cap != null ? Number(p.max_discount_cap) : null,
    max_discount_cap: p.max_discount_cap,
    usageLimit: Number(p.usage_limit || 0),
    timesUsed: Number(p.times_used || 0),
    isActive: p.is_active === 1 || p.is_active === true,
    is_active: p.is_active,
    expiresAt: p.expires_at,
    description: p.description || '',
    createdAt: p.created_at
  }));
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest) {
  const admin = getAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  await ensurePromoTable();
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim().toUpperCase();
  const discountType = String(body.discountType || body.discount_type || 'percentage');
  const value = Number(body.value);
  if (!code || !Number.isFinite(value)) {
    return NextResponse.json(
      { success: false, error: 'Code and value are required' },
      { status: 400 }
    );
  }
  const id = `promo-${Date.now()}`;
  const now = new Date().toISOString();
  const minOrder = Number(body.minOrderAmount ?? body.min_order_amount ?? 0);
  const maxCap = Number(body.maxDiscountCap ?? body.max_discount_cap ?? 2500);
  const expiresAt = body.expiresAt || body.expires_at || null;
  const description = String(body.description || '');

  await d1.query(
    `INSERT INTO promo_codes (
      id, code, discount_type, value, min_order_amount, max_discount_cap,
      usage_limit, times_used, is_active, expires_at, description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
    [
      id,
      code,
      discountType,
      value,
      minOrder,
      maxCap,
      Number(body.usageLimit ?? body.usage_limit ?? 1000),
      expiresAt,
      description,
      now
    ]
  );

  return NextResponse.json({
    success: true,
    data: {
      id,
      code,
      discountType,
      value,
      minOrderAmount: minOrder,
      maxDiscountCap: maxCap,
      expiresAt,
      description,
      isActive: true
    }
  });
}
