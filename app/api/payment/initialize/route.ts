import { NextRequest, NextResponse } from 'next/server';
import { paymentGateway } from '../../../../lib/payment';
import { d1Client } from '../../../../server/db/d1Client';
import jwt from 'jsonwebtoken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(auth.slice(7), secret) as { id?: string };
    return typeof payload.id === 'string' && payload.id ? payload.id : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getBearerUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const userResult = await d1Client.query('SELECT id, email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!userResult.success) return NextResponse.json({ success: false, error: 'Could not verify account for payment' }, { status: 503 });
    const account = userResult.results?.[0];
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    const email = String(body.email || '').trim().toLowerCase();
    if (email !== String(account.email || '').trim().toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Payment email must match the signed-in account' }, { status: 403 });
    }
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return NextResponse.json({ success: false, error: 'APP_URL is not configured for payment callbacks' }, { status: 503 });
    const callbackUrl = `${appUrl.replace(/\/+$/, '')}/payment/callback`;
    const metadata =
      body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    if (!email || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid email and amount are required' },
        { status: 400 }
      );
    }

    const result = await paymentGateway.initializePayment({
      email,
      amountNGN: amount,
      callbackUrl,
      metadata: { ...metadata, userId }
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Paystack initialize failed' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const transaction = await d1Client.query(
      `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
       VALUES (?, ?, ?, ?, 'NGN', 'pending', 'Paystack', ?)`,
      [`txn-init-${Date.now()}`, (metadata as any).orderId || null, result.reference, amount, nowIso]
    );
    if (!transaction.success) {
      console.error('[Payment initialize] Provider initialized but transaction record failed', { reference: result.reference });
      return NextResponse.json({ success: false, error: 'Payment was initialized but could not be recorded. Contact support before retrying.', reference: result.reference }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Payment init error' },
      { status: 500 }
    );
  }
}
