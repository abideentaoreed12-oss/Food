import { NextRequest, NextResponse } from 'next/server';
import { paystackLiveGate } from '../../../../lib/paystackGate';
import { d1Client } from '../../../../server/db/d1Client';
import { d1 } from '../../../../lib/d1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function processVerification(reference: string) {
  if (!reference) {
    return NextResponse.json(
      { success: false, error: 'Missing payment reference' },
      { status: 400 }
    );
  }

  const result = await paystackLiveGate.verifyTransaction(reference, {
    applyDatabaseUpdates: false,
  });

  if (!result.success || !result.isPaid) {
    return NextResponse.json({
      success: false,
      isPaid: false,
      status: result.status || 'failed',
      error: result.error || result.gatewayResponse || 'Payment verification failed'
    });
  }

  const amountPaid = result.amountNGN;
  const currency = String(result.currency || 'NGN').toUpperCase();
  const metadata = result.metadata || {};
  const orderId = metadata.orderId || null;
  const userId = metadata.userId || null;
  const nowIso = new Date().toISOString();

  // 1. Fetch order if orderId is specified
  let order: any = null;
  if (orderId) {
    const orderRes = await d1Client.query(
      'SELECT id, short_id, payment_status, total, currency FROM orders WHERE id = ? OR short_id = ? LIMIT 1',
      [orderId, orderId]
    ).catch(() => ({ results: [] as any[] }));
    order = orderRes.results?.[0] || null;

    if (order) {
      const expectedAmount = Number(order.total);
      const expectedCurrency = String(order.currency || 'NGN').toUpperCase();

      if (Math.abs(expectedAmount - amountPaid) > 0.05) {
        console.error(`[Verify] Amount mismatch for order ${orderId}: expected ${expectedAmount}, received ${amountPaid}`);
        return NextResponse.json(
          { success: false, error: 'Payment amount mismatch against order' },
          { status: 400 }
        );
      }

      if (currency !== expectedCurrency) {
        console.error(`[Verify] Currency mismatch for order ${orderId}: expected ${expectedCurrency}, received ${currency}`);
        return NextResponse.json(
          { success: false, error: 'Payment currency mismatch against order' },
          { status: 400 }
        );
      }

      const updateOrder = await d1Client.query(
        'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ? OR short_id = ?',
        ['paid', nowIso, order.id, order.id]
      );
      if (!updateOrder.success) {
        console.error(`[Verify] Failed to update order payment status: ${order.id}`);
      }
    }
  }

  // 2. Update or insert transaction record
  const existingTxRes = await d1Client.query(
    'SELECT id, status, amount FROM transactions WHERE reference = ? LIMIT 1',
    [reference]
  ).catch(() => ({ results: [] as any[] }));
  const existingTx = existingTxRes.results?.[0];

  if (existingTx) {
    await d1Client.query(
      'UPDATE transactions SET status = ?, amount = ?, currency = ? WHERE reference = ?',
      ['completed', amountPaid, currency, reference]
    ).catch(() => {});
  } else {
    const txId = `txn-paystack-${Date.now()}`;
    await d1Client.query(
      'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, order?.id || orderId, reference, amountPaid, currency, 'completed', 'Paystack Online', nowIso]
    ).catch(() => {});
  }

  // 3. Process wallet topup if applicable and not already processed
  if (metadata.type === 'wallet_topup' || (userId && !orderId)) {
    const existingWalletTx = await d1Client.query(
      'SELECT id, status FROM wallet_transactions WHERE reference = ? LIMIT 1',
      [reference]
    ).catch(() => ({ results: [] as any[] }));

    if (!existingWalletTx.results?.[0] || existingWalletTx.results[0].status !== 'completed') {
      const targetUserId = userId;
      if (targetUserId) {
        await d1Client.query(
          'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
          [amountPaid, nowIso, targetUserId]
        ).catch(() => {});

        const txId = `tx-dep-${Date.now()}`;
        await d1Client.query(
          `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
           VALUES (?, ?, 'deposit', ?, ?, 'Wallet Deposit via Paystack', ?, 'Paystack', 'completed', ?)`,
          [txId, targetUserId, amountPaid, currency, reference, nowIso]
        ).catch(() => {});
      }
    }
  }

  // 4. Invalidate D1 memory query cache so fresh data is visible immediately
  d1.clearCache();

  return NextResponse.json({
    success: true,
    isPaid: true,
    status: 'success',
    data: {
      reference,
      amountNGN: amountPaid,
      currency,
      orderId: order?.id || orderId,
      customerEmail: result.customer?.email || result.customerEmail
    }
  });
}

export async function GET(req: NextRequest) {
  const reference = (
    req.nextUrl.searchParams.get('reference') ||
    req.nextUrl.searchParams.get('trxref') ||
    ''
  ).trim();

  return processVerification(reference);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const reference = String(
    body.reference ||
    body.trxref ||
    req.nextUrl.searchParams.get('reference') ||
    req.nextUrl.searchParams.get('trxref') ||
    ''
  ).trim();

  return processVerification(reference);
}
