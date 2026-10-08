import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { d1 } from '../../../../lib/d1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getUser(req: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, secret) as any;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = getUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const codeUpper = String(body.code || '').trim().toUpperCase();
  const cleanSubtotal = Number(body.subtotal);
  if (!Number.isFinite(cleanSubtotal) || cleanSubtotal < 0) {
    return NextResponse.json({ success: false, valid: false, error: 'A valid order subtotal is required' }, { status: 400 });
  }
  if (!codeUpper) {
    return NextResponse.json({ success: false, error: 'Promo code required' }, { status: 400 });
  }

  const d1Res = await d1.query(`SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1 LIMIT 1`, [codeUpper]);
  if (!d1Res.success) {
    return NextResponse.json({ success: false, valid: false, error: 'Promo service is temporarily unavailable' }, { status: 503 });
  }
  if (!d1Res.results?.length) {
    return NextResponse.json(
      { success: false, valid: false, error: 'Invalid or inactive promo code' },
      { status: 404 }
    );
  }

  const p = d1Res.results[0];
  if (p.expires_at) {
    const exp = new Date(p.expires_at).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Promo code has expired' },
        { status: 400 }
      );
    }
  }
  if (p.usage_limit != null && Number(p.times_used || 0) >= Number(p.usage_limit)) {
    return NextResponse.json(
      { success: false, valid: false, error: 'Promo code usage limit reached' },
      { status: 400 }
    );
  }
  if (cleanSubtotal < Number(p.min_order_amount || 0)) {
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: `Minimum order ₦${Number(p.min_order_amount || 0).toLocaleString('en-NG')} required`
      },
      { status: 400 }
    );
  }

  const val = Number(p.value || 0);
  if (!Number.isFinite(val) || val <= 0 || !['percentage', 'fixed'].includes(p.discount_type)) {
    return NextResponse.json({ success: false, valid: false, error: 'Promo configuration is invalid' }, { status: 500 });
  }
  const cap = p.max_discount_cap == null || p.max_discount_cap === '' ? null : Number(p.max_discount_cap);
  if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
    return NextResponse.json({ success: false, valid: false, error: 'Promo discount cap is invalid' }, { status: 500 });
  }
  const rawDiscount = p.discount_type === 'percentage' ? Math.round(cleanSubtotal * (val / 100)) : val;
  const discountAmount = cap === null ? rawDiscount : Math.min(cap, rawDiscount);

  return NextResponse.json({
    success: true,
    valid: true,
    code: codeUpper,
    discountAmount,
    description: p.description || `${p.discount_type} discount`,
    data: {
      valid: true,
      code: codeUpper,
      discountAmount,
      description: p.description || `${p.discount_type} discount`
    }
  });
}
