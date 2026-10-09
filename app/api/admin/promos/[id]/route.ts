import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { d1 } from '../../../../../lib/d1';

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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  if (body.toggle === true || Object.keys(body).length === 0) {
    const current = await d1.query('SELECT is_active FROM promo_codes WHERE id = ? OR code = ? LIMIT 1', [id, id]);
    if (!current.success) return NextResponse.json({ success: false, error: 'Promo database query failed' }, { status: 503 });
    if (!current.results?.length) {
      return NextResponse.json({ success: false, error: 'Promo not found' }, { status: 404 });
    }
    const nextActive = current.results[0].is_active === 1 ? 0 : 1;
    const updated = await d1.query('UPDATE promo_codes SET is_active = ? WHERE id = ? OR code = ?', [nextActive, id, id]);
    if (!updated.success || updated.meta?.rows_written === 0) return NextResponse.json({ success: false, error: 'Promo status was not updated' }, { status: 503 });
    return NextResponse.json({ success: true, isActive: nextActive === 1 });
  }

  const fields: string[] = [];
  const vals: any[] = [];
  if (body.code != null) {
    fields.push('code = ?');
    vals.push(String(body.code).trim().toUpperCase());
  }
  if (body.discountType != null || body.discount_type != null) {
    fields.push('discount_type = ?');
    vals.push(body.discountType || body.discount_type);
  }
  if (body.value != null) {
    fields.push('value = ?');
    vals.push(Number(body.value));
  }
  if (body.minOrderAmount != null || body.min_order_amount != null) {
    fields.push('min_order_amount = ?');
    vals.push(Number(body.minOrderAmount ?? body.min_order_amount));
  }
  if (body.maxDiscountCap != null || body.max_discount_cap != null) {
    fields.push('max_discount_cap = ?');
    vals.push(Number(body.maxDiscountCap ?? body.max_discount_cap));
  }
  if (body.expiresAt != null || body.expires_at != null) {
    fields.push('expires_at = ?');
    vals.push(body.expiresAt ?? body.expires_at);
  }
  if (body.description != null) {
    fields.push('description = ?');
    vals.push(String(body.description));
  }
  if (body.isActive != null || body.is_active != null) {
    fields.push('is_active = ?');
    vals.push(body.isActive === true || body.is_active === 1 || body.is_active === true ? 1 : 0);
  }
  if (!fields.length) {
    return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
  }
  vals.push(id, id);
  const updated = await d1.query(`UPDATE promo_codes SET ${fields.join(', ')} WHERE id = ? OR code = ?`, vals);
  if (!updated.success) return NextResponse.json({ success: false, error: 'Promo update failed' }, { status: 503 });
  if (updated.meta?.rows_written === 0) return NextResponse.json({ success: false, error: 'Promo not found' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Promo updated in D1' });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const admin = getAdmin(_req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const deleted = await d1.query('DELETE FROM promo_codes WHERE id = ? OR UPPER(code) = UPPER(?)', [id, id]);
  if (!deleted.success) return NextResponse.json({ success: false, error: 'Promo deletion failed' }, { status: 503 });
  if (deleted.meta?.rows_written === 0) return NextResponse.json({ success: false, error: 'Promo not found' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Promo code deleted from D1' });
}
