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
    const webhookSecret =
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      process.env.PAYMENT_SECRET_KEY ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      '';
    const isProd = process.env.NODE_ENV === 'production';

    if (!webhookSecret) {
      console.error('[Paystack webhook] PAYSTACK_SECRET_KEY / PAYSTACK_WEBHOOK_SECRET is not set');
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
      const reference = String(data.reference || '');
      const metadata = data.metadata || {};
      const orderId = metadata.orderId || null;
      const userId = metadata.userId || null;
      const amountPaid = (Number(data.amount) || 0) / 100;
      const currency = String(data.currency || 'NGN').toUpperCase();
      const nowIso = new Date().toISOString();

      if (!reference) {
        return NextResponse.json({ success: false, error: 'Missing reference' }, { status: 400 });
      }

      // 1. Check existing transaction state for accurate idempotency
      const existingTxRes = await d1Client.query(
        'SELECT id, order_id, amount, currency, status FROM transactions WHERE reference = ? LIMIT 1',
        [reference]
      ).catch((err) => {
        console.error('[Paystack webhook] Error querying transactions:', err);
        throw new Error('Database lookup failure for transaction');
      });
      const existingTx = existingTxRes.results?.[0];

      const existingWalletTxRes = await d1Client.query(
        'SELECT id, status, amount FROM wallet_transactions WHERE reference = ? LIMIT 1',
        [reference]
      ).catch((err) => {
        console.error('[Paystack webhook] Error querying wallet transactions:', err);
        throw new Error('Database lookup failure for wallet transaction');
      });
      const existingWalletTx = existingWalletTxRes.results?.[0];

      let order: any = null;
      if (orderId) {
        const orderRes = await d1Client.query(
          'SELECT id, short_id, payment_status, total, currency FROM orders WHERE id = ? OR short_id = ? LIMIT 1',
          [orderId, orderId]
        ).catch((err) => {
          console.error('[Paystack webhook] Error querying orders:', err);
          throw new Error('Database lookup failure for order');
        });
        order = orderRes.results?.[0] || null;
      }

      // Check if already completed/paid (Never short-circuit on 'pending'!)
      const isTxCompleted = existingTx && (existingTx.status === 'completed' || existingTx.status === 'success');
      const isWalletCompleted = existingWalletTx && (existingWalletTx.status === 'completed' || existingWalletTx.status === 'success');
      const isOrderPaid = order && (order.payment_status === 'paid' || order.paymentStatus === 'paid');

      if (isTxCompleted || isWalletCompleted || isOrderPaid) {
        return NextResponse.json({ success: true, message: 'Webhook event already processed (idempotent)' });
      }

      // 2. Validate payment amount & currency against stored order or transaction
      if (order) {
        const expectedOrderAmount = Number(order.total);
        const expectedOrderCurrency = String(order.currency || 'NGN').toUpperCase();

        if (Math.abs(expectedOrderAmount - amountPaid) > 0.05) {
          console.error(`[Paystack Webhook] Amount mismatch for order ${orderId}: expected ${expectedOrderAmount}, received ${amountPaid}`);
          await db.logAudit({
            action: 'PAYSTACK_WEBHOOK_AMOUNT_MISMATCH',
            resource: 'ORDER',
            resourceId: orderId,
            details: { expectedAmount: expectedOrderAmount, amountPaid, reference, currency }
          }).catch(() => {});
          return NextResponse.json({ success: false, error: 'Payment amount mismatch' }, { status: 400 });
        }

        if (currency !== expectedOrderCurrency) {
          console.error(`[Paystack Webhook] Currency mismatch for order ${orderId}: expected ${expectedOrderCurrency}, received ${currency}`);
          return NextResponse.json({ success: false, error: 'Payment currency mismatch' }, { status: 400 });
        }
      }

      if (existingTx && existingTx.amount) {
        if (Math.abs(Number(existingTx.amount) - amountPaid) > 0.05) {
          console.error(`[Paystack Webhook] Amount mismatch with initialized transaction: expected ${existingTx.amount}, received ${amountPaid}`);
          return NextResponse.json({ success: false, error: 'Transaction amount mismatch' }, { status: 400 });
        }
      }

      // 3. Process Order Payment with strict error propagation
      if (orderId && order) {
        const orderUpdate = await d1Client.query(
          'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ? OR short_id = ?',
          ['paid', nowIso, order.id, order.id]
        );
        if (!orderUpdate || orderUpdate.success === false) {
          throw new Error(`Failed to update order ${order.id} payment status to paid`);
        }

        if (existingTx) {
          const txUpdate = await d1Client.query(
            'UPDATE transactions SET status = ?, amount = ?, currency = ? WHERE id = ?',
            ['completed', amountPaid, currency, existingTx.id]
          );
          if (!txUpdate || txUpdate.success === false) {
            throw new Error(`Failed to update transaction ${existingTx.id} status to completed`);
          }
        } else {
          const txId = `txn-paystack-${Date.now()}`;
          const txInsert = await d1Client.query(
            'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [txId, order.id, reference, amountPaid, currency, 'completed', 'Paystack Online', nowIso]
          );
          if (!txInsert || txInsert.success === false) {
            throw new Error(`Failed to insert transaction record for reference ${reference}`);
          }
        }

        await db.logAudit({
          action: 'PAYSTACK_WEBHOOK_SUCCESS',
          resource: 'ORDER',
          resourceId: order.id,
          details: { reference, amount: amountPaid, currency }
        }).catch(() => {});
      }

      // 4. Process Wallet Topup with strict error propagation
      if (metadata.type === 'wallet_topup' || (userId && !orderId)) {
        let targetUserId = userId;
        if (!targetUserId && data.customer?.email) {
          const userLookup = await d1Client.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
            [data.customer.email]
          );
          targetUserId = userLookup.results?.[0]?.id || null;
        }

        if (targetUserId) {
          const walletUpdate = await d1Client.query(
            'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + ?, updated_at = ? WHERE id = ?',
            [amountPaid, nowIso, targetUserId]
          );
          if (!walletUpdate || walletUpdate.success === false) {
            throw new Error(`Failed to update wallet balance for user ${targetUserId}`);
          }

          const txId = `tx-dep-${Date.now()}`;
          const walletTxInsert = await d1Client.query(
            `INSERT INTO wallet_transactions (id, user_id, type, amount, currency, description, reference, payment_method, status, created_at)
             VALUES (?, ?, 'deposit', ?, ?, 'Wallet Deposit via Paystack', ?, 'Paystack', 'completed', ?)`,
            [txId, targetUserId, amountPaid, currency, reference, nowIso]
          );
          if (!walletTxInsert || walletTxInsert.success === false) {
            throw new Error(`Failed to insert wallet transaction for user ${targetUserId}`);
          }

          await db.logAudit({
            action: 'PAYSTACK_WALLET_TOPUP_SUCCESS',
            resource: 'USER_WALLET',
            resourceId: targetUserId,
            details: { reference, amount: amountPaid, currency }
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Paystack webhook error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal webhook processing error' }, { status: 500 });
  }
}
