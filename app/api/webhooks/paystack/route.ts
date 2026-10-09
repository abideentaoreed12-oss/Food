import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '../../../../server/db/index';
import { d1Client } from '../../../../server/db/d1Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '';
    const isProd = process.env.NODE_ENV === 'production';

    if (!webhookSecret) {
      console.error('[Paystack webhook] PAYSTACK_WEBHOOK_SECRET / PAYMENT_WEBHOOK_SECRET is not set');
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: isProd ? 503 : 401 }
      );
    }
    if (!signature) {
      return NextResponse.json({ success: false, error: 'Missing x-paystack-signature header' }, { status: 401 });
    }
    const hash = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
    if (hash !== signature) {
      return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const data = event.data || {};
      const reference = data.reference;
      const metadata = data.metadata || {};
      const orderId = metadata.orderId;
      const userId = metadata.userId;
      const amountMinor = Number(data.amount);
      const amountPaid = amountMinor / 100;
      const nowIso = new Date().toISOString();

      if (data.status !== 'success' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid or unsuccessful payment event' }, { status: 400 });
      }

      if (!reference) {
        return NextResponse.json({ success: false, error: 'Missing reference' }, { status: 400 });
      }

      const [existingTx, existingWalletTx] = await Promise.all([
        d1Client.query('SELECT id, status, amount FROM transactions WHERE reference = ? LIMIT 1', [reference]),
        d1Client.query('SELECT id, status FROM wallet_transactions WHERE reference = ? LIMIT 1', [reference])
      ]);
      if (!existingTx.success || !existingWalletTx.success) {
        return NextResponse.json({ success: false, error: 'Payment records could not be verified' }, { status: 503 });
      }
      if (existingWalletTx.results?.some((row: any) => row.status === 'completed') ||
          existingTx.results?.some((row: any) => row.status === 'completed')) {
        return NextResponse.json({ success: true, message: 'Webhook event already processed (idempotent)' });
      }
      const pendingTx = existingTx.results?.[0];
      if (pendingTx && Number(pendingTx.amount) > 0 && Math.round(Number(pendingTx.amount) * 100) !== amountMinor) {
        return NextResponse.json({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
      }

      if (orderId) {
        const order = await db.getOrderById(orderId);
        if (!order) {
          return NextResponse.json({ success: false, error: 'Order could not be verified' }, { status: 400 });
        }
        const expectedAmountMinor = Math.round((Number(order.total) - Number(order.walletDeduction || 0)) * 100);
        if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0 ||
            expectedAmountMinor !== amountMinor ||
            String(order.currency || 'NGN').toUpperCase() !== String(data.currency || '').toUpperCase()) {
          return NextResponse.json({ success: false, error: 'Payment amount or currency does not match the order' }, { status: 400 });
        }
        if (String(order.paymentStatus).toLowerCase() === 'paid') {
          return NextResponse.json({ success: true, message: 'Order is already paid' });
        }
        const txId = `txn-paystack-${Date.now()}`;
        const transactionResult = await d1Client.query(
          'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [txId, orderId, reference, amountPaid, String(order.currency || 'NGN').toUpperCase(), 'completed', 'Paystack Online', nowIso]
        );
        if (!transactionResult.success) {
          return NextResponse.json({ success: false, error: 'Payment transaction could not be recorded' }, { status: 503 });
        }
        const orderResult = await d1Client.query(
          'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ? AND LOWER(COALESCE(payment_status, \'pending\')) != \'paid\'',
          ['paid', nowIso, orderId]
        );
        if (!orderResult.success) {
          return NextResponse.json({ success: false, error: 'Order payment status could not be updated' }, { status: 503 });
        }
        order.paymentStatus = 'paid';
        await db.createTransaction({
          id: txId,
          orderId,
          reference,
          amount: amountPaid,
          currency: String(order.currency || 'NGN').toUpperCase(),
          status: 'completed',
          paymentMethod: 'Paystack Online',
          idempotencyKey: `idemp_webhook_${reference}`,
          createdAt: nowIso
        });
        await db.logAudit({
          action: 'PAYSTACK_WEBHOOK_SUCCESS',
          resource: 'ORDER',
          resourceId: orderId,
          details: { reference, amount: amountPaid }
        });
      }

      if (metadata.type === 'wallet_topup' || (userId && !orderId)) {
        if (String(data.currency || '').toUpperCase() !== 'NGN') {
          return NextResponse.json({ success: false, error: 'Wallet top-ups must be paid in NGN' }, { status: 400 });
        }
        const targetUserId = userId || (data.customer?.email ? (await d1Client.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [data.customer.email])).results?.[0]?.id : null);

        if (targetUserId) {
          const txId = `tx-dep-${Date.now()}`;
          const walletUpdate = await d1Client.query(
            'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
            [amountPaid, nowIso, targetUserId]
          );
          if (!walletUpdate.success || (walletUpdate.meta?.rows_written ?? 0) < 1) {
            return NextResponse.json({ success: false, error: 'Wallet balance could not be updated' }, { status: 503 });
          }

          const walletLedger = await d1Client.query(
            `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
             VALUES (?, ?, 'deposit', ?, 'NGN', 'Wallet Deposit via Paystack', ?, 'Paystack', 'completed', ?)`,
            [txId, targetUserId, amountPaid, reference, nowIso]
          );
          if (!walletLedger.success) {
            return NextResponse.json({ success: false, error: 'Wallet transaction could not be recorded; manual reconciliation is required' }, { status: 503 });
          }

          await db.logAudit({
            action: 'PAYSTACK_WALLET_TOPUP_SUCCESS',
            resource: 'USER_WALLET',
            resourceId: targetUserId,
            details: { reference, amount: amountPaid }
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Paystack webhook error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
