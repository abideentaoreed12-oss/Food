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

    if (signature && webhookSecret) {
      const hash = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
      if (hash !== signature) {
        return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const data = event.data;
      const reference = data.reference;
      const metadata = data.metadata || {};
      const orderId = metadata.orderId;
      const amountPaid = (data.amount || 0) / 100;
      const nowIso = new Date().toISOString();

      if (orderId) {
        const order = await db.getOrderById(orderId);
        if (order) {
          order.paymentStatus = 'paid';
          const txId = `txn-paystack-${Date.now()}`;

          await db.createTransaction({
            id: txId,
            orderId,
            reference,
            amount: amountPaid,
            currency: order.currency || 'NGN',
            status: 'completed',
            paymentMethod: 'Paystack Online',
            idempotencyKey: `idemp_webhook_${reference}`,
            createdAt: nowIso
          });

          await d1Client.query(
            'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?',
            ['paid', nowIso, orderId]
          ).catch(() => {});

          await d1Client.query(
            'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [txId, orderId, reference, amountPaid, order.currency || 'NGN', 'completed', 'Paystack Online', nowIso]
          ).catch(() => {});

          await db.logAudit({
            action: 'PAYSTACK_WEBHOOK_SUCCESS',
            resource: 'ORDER',
            resourceId: orderId,
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
