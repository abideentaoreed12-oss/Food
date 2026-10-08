import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { d1 } from '../../../../../../lib/d1';

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
  const current = await d1
    .query('SELECT is_active FROM promo_codes WHERE id = ? OR code = ? LIMIT 1', [id, id])
    .catch(() => ({ results: [] as any[] }));
  if (!current.results?.length) {
    return NextResponse.json({ success: false, error: 'Promo not found in D1' }, { status: 404 });
  }
  const nextActive = current.results[0].is_active === 1 ? 0 : 1;
  await d1.query('UPDATE promo_codes SET is_active = ? WHERE id = ? OR code = ?', [
    nextActive,
    id,
    id
  ]);
  return NextResponse.json({ success: true, isActive: nextActive === 1, data: { isActive: nextActive === 1 } });
}
