import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { d1Client } from '../db/d1Client.ts';
import { CONFIG } from '../config.ts';

const router = Router();

const WEBHOOK_SECRET = CONFIG.PAYMENT_WEBHOOK_SECRET;

// Idempotent webhook receiver
router.post('/payment', async (req: Request, res: Response) => {
  try {
    const rawSignature = (req.headers['x-veyrang-signature'] || req.headers['stripe-signature']) as string | undefined;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: 'Missing Idempotency-Key header' });
    }

    // Cryptographic Webhook Signature Verification
    if (rawSignature) {
      try {
        const cleanSig = rawSignature.startsWith('sha256=') ? rawSignature.slice(7) : rawSignature;
        const computedHash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex');
        const sigBuffer = Buffer.from(cleanSig, 'hex');
        const compBuffer = Buffer.from(computedHash, 'hex');

        if (sigBuffer.length !== compBuffer.length || !crypto.timingSafeEqual(sigBuffer, compBuffer)) {
          return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
        }
      } catch (sigErr) {
        return res.status(401).json({ success: false, error: 'Webhook signature verification failed.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, error: 'Webhook signature required in production.' });
    }

    // Check if event was already processed
    const existing = await db.getTransactionByIdempotencyKey(idempotencyKey);
    if (existing && existing.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Event already processed idempotently',
        transactionId: existing.id
      });
    }

    const { eventType, orderId, amount, paymentMethod, reference } = req.body;
    const nowIso = new Date().toISOString();

    if (eventType === 'payment_intent.succeeded' && orderId) {
      const order = await db.getOrderById(orderId);
      if (order) {
        order.paymentStatus = 'paid';
        const txId = `txn-wh-${Date.now()}`;
        const ref = reference || `ref_${Date.now()}`;
        const paidAmount = amount || order.total;

        await db.createTransaction({
          id: txId,
          orderId,
          reference: ref,
          amount: paidAmount,
          currency: (order.currency as any) || 'USD',
          status: 'completed',
          paymentMethod: paymentMethod || 'Online Gateway',
          idempotencyKey,
          createdAt: nowIso
        });

        // Sync directly to Cloudflare D1 orders and transactions tables
        await d1Client.query(
          'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?',
          ['paid', nowIso, orderId]
        ).catch(() => {});

        await d1Client.query(
          'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [txId, orderId, ref, paidAmount, order.currency || 'NGN', 'completed', paymentMethod || 'Online Gateway', nowIso]
        ).catch(() => {});

        await db.logAudit({
          action: 'PAYMENT_WEBHOOK_PROCESSED',
          resource: 'ORDER',
          resourceId: orderId,
          details: { amount: paidAmount, idempotencyKey }
        });
      }
    }

    return res.status(200).json({ success: true, processed: true });
  } catch (error) {
    console.error('Webhook processing failure:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// Paystack Official Webhook Receiver
router.post('/paystack', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-paystack-signature'] as string) || '';
    const secret =
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYSTACK_WEBHOOK_SECRET ||
      process.env.PAYMENT_SECRET_KEY ||
      process.env.PAYMENT_WEBHOOK_SECRET ||
      '';

    if (!secret) {
      console.error('[Paystack webhook] PAYSTACK_SECRET_KEY is not configured');
      return res.status(process.env.NODE_ENV === 'production' ? 503 : 401).json({
        success: false,
        error: 'Webhook secret not configured'
      });
    }

    if (!signature) {
      return res.status(401).json({ success: false, error: 'Missing x-paystack-signature header' });
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
    }

    const event = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody);

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
        return res.status(400).json({ success: false, error: 'Missing reference' });
      }

      // 1. Check idempotency accurately without treating pending as completed
      const txRes = await d1Client.query(
        'SELECT id, order_id, amount, currency, status FROM transactions WHERE reference = ? LIMIT 1',
        [reference]
      ).catch((err) => {
        console.error('[Paystack webhook Express] Error querying transactions:', err);
        throw new Error('Database lookup failure for transaction');
      });
      const existingTx = txRes.results?.[0];

      const walletTxRes = await d1Client.query(
        'SELECT id, status, amount FROM wallet_transactions WHERE reference = ? LIMIT 1',
        [reference]
      ).catch((err) => {
        console.error('[Paystack webhook Express] Error querying wallet transactions:', err);
        throw new Error('Database lookup failure for wallet transaction');
      });
      const existingWalletTx = walletTxRes.results?.[0];

      let order: any = null;
      if (orderId) {
        const orderRes = await d1Client.query(
          'SELECT id, short_id, payment_status, total, currency FROM orders WHERE id = ? OR short_id = ? LIMIT 1',
          [orderId, orderId]
        ).catch((err) => {
          console.error('[Paystack webhook Express] Error querying orders:', err);
          throw new Error('Database lookup failure for order');
        });
        order = orderRes.results?.[0] || null;
      }

      const isTxCompleted = existingTx && (existingTx.status === 'completed' || existingTx.status === 'success');
      const isWalletCompleted = existingWalletTx && (existingWalletTx.status === 'completed' || existingWalletTx.status === 'success');
      const isOrderPaid = order && (order.payment_status === 'paid' || order.paymentStatus === 'paid');

      if (isTxCompleted || isWalletCompleted || isOrderPaid) {
        return res.status(200).json({ success: true, message: 'Webhook event already processed (idempotent)' });
      }

      // 2. Validate amount & currency
      if (order) {
        const expectedOrderAmount = Number(order.total);
        const expectedOrderCurrency = String(order.currency || 'NGN').toUpperCase();

        if (Math.abs(expectedOrderAmount - amountPaid) > 0.05) {
          console.error(`[Paystack Webhook Express] Amount mismatch for order ${orderId}: expected ${expectedOrderAmount}, received ${amountPaid}`);
          return res.status(400).json({ success: false, error: 'Payment amount mismatch' });
        }

        if (currency !== expectedOrderCurrency) {
          console.error(`[Paystack Webhook Express] Currency mismatch for order ${orderId}: expected ${expectedOrderCurrency}, received ${currency}`);
          return res.status(400).json({ success: false, error: 'Payment currency mismatch' });
        }
      }

      // 3. Process order updates
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

      // 4. Process wallet topup
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

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Paystack webhook Express error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal webhook processing error' });
  }
});

export default router;
