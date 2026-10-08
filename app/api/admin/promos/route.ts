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

export async function GET(req: NextRequest) {
  const admin = getAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  const res = await d1.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
  if (!res.success) return NextResponse.json({ success: false, error: 'Promo database query failed' }, { status: 503 });
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
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim().toUpperCase();
  const discountType = String(body.discountType || body.discount_type || '');
  const value = Number(body.value);
  if (!code || !Number.isFinite(value) || value <= 0 || !['percentage', 'fixed'].includes(discountType)) {
    return NextResponse.json(
      { success: false, error: 'A code, positive discount value, and valid discount type (percentage or fixed) are required' },
      { status: 400 }
    );
  }
  const id = `promo-${Date.now()}`;
  const now = new Date().toISOString();
  const minOrder = Number(body.minOrderAmount ?? body.min_order_amount);
  const capInput = body.maxDiscountCap ?? body.max_discount_cap;
  const maxCap = capInput == null || capInput === '' ? null : Number(capInput);
  const usageLimit = Number(body.usageLimit ?? body.usage_limit);
  if (!Number.isFinite(minOrder) || minOrder < 0 || (maxCap !== null && (!Number.isFinite(maxCap) || maxCap < 0)) || !Number.isInteger(usageLimit) || usageLimit < 1) {
    return NextResponse.json({ success: false, error: 'Minimum order, discount cap, and usage limit must be valid. Provide a usage limit of at least 1.' }, { status: 400 });
  }
  const expiresAt = body.expiresAt || body.expires_at || null;
  const description = String(body.description || '');

  const inserted = await d1.query(
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
      usageLimit,
      expiresAt,
      description,
      now
    ]
  );

  if (!inserted.success) return NextResponse.json({ success: false, error: 'Promo could not be saved to the database' }, { status: 503 });

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
