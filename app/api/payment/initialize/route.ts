import { NextRequest, NextResponse } from 'next/server';
import { paymentGateway } from '../../../../lib/payment';
import { d1Client } from '../../../../server/db/d1Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const token = auth.slice(7);
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')
    );
    return payload?.id || null;
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
    const email = String(body.email || '').trim();
    const amount = Number(body.amount);
    const callbackUrl = body.callbackUrl
      ? String(body.callbackUrl)
      : `${process.env.APP_URL || 'https://veyrang.com'}/payment/callback`;
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
    await d1Client
      .query(
        `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
         VALUES (?, ?, ?, ?, 'NGN', 'pending', 'Paystack', ?)`,
        [
          `txn-init-${Date.now()}`,
          (metadata as any).orderId || null,
          result.reference,
          amount,
          nowIso
        ]
      )
      .catch(() => {});

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
