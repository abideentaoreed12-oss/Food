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

export default router;
