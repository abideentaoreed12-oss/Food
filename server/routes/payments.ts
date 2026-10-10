import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { d1Client } from '../db/d1Client.ts';
import { validateBody } from '../middleware/validate.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { paymentGateway } from '../../lib/payment.ts';

const router = Router();

const InitializeSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  callbackUrl: z.string().optional(),
  // Zod 4-safe: avoid z.record arity issues under Next typecheck
  metadata: z.any().optional()
});

async function loadVirtualAccountFromD1(userId: string) {
  const res = await d1Client
    .query(
      `SELECT account_number, bank_name, account_name
       FROM user_virtual_accounts
       WHERE user_id = ? AND is_active = 1
       LIMIT 1`,
      [userId]
    )
    .catch(() => ({ results: [] as any[] }));
  const row = res.results?.[0];
  if (!row?.account_number || !row?.bank_name) return null;
  return {
    accountNumber: String(row.account_number),
    bankName: String(row.bank_name),
    accountName: String(row.account_name || '')
  };
}

function appUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://veyrang.com';
}

/** Initialize official Paystack checkout */
router.post(
  '/initialize',
  requireAuth,
  validateBody(InitializeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email, amount, callbackUrl, metadata } = req.body as {
        email: string;
        amount: number;
        callbackUrl?: string;
        metadata?: Record<string, unknown>;
      };
      const userId = req.user!.id;
      const meta =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? { ...(metadata as Record<string, unknown>), userId }
          : { userId };

      const result = await paymentGateway.initializePayment({
        email,
        amountNGN: amount,
        callbackUrl: callbackUrl || `${appUrl()}/payment/callback`,
        metadata: meta
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || 'Paystack initialize failed'
        });
      }

      const nowIso = new Date().toISOString();
      const orderId =
        meta && typeof meta === 'object' && 'orderId' in meta
          ? (meta as any).orderId
          : null;

      await d1Client
        .query(
          `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
           VALUES (?, ?, ?, ?, 'NGN', 'pending', 'Paystack', ?)`,
          [`txn-init-${Date.now()}`, orderId, result.reference, amount, nowIso]
        )
        .catch(() => {});

      return res.json({
        success: true,
        data: {
          authorizationUrl: result.authorizationUrl,
          accessCode: result.accessCode,
          reference: result.reference
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message || 'Payment init error'
      });
    }
  }
);

/** Verification handler logic for Paystack transactions */
async function handleVerify(reference: string, res: Response) {
  if (!reference) {
    return res.status(400).json({ success: false, error: 'Payment reference required' });
  }

  const result = await paymentGateway.verifyPayment(reference);
  if (!result.success || !result.isPaid) {
    return res.status(200).json({
      success: false,
      isPaid: false,
      status: result.status || 'failed',
      error: result.error || result.gatewayResponse || 'Payment verification failed'
    });
  }

  const nowIso = new Date().toISOString();
  const amountPaid = result.amountNGN;
  const currency = String(result.currency || 'NGN').toUpperCase();
  const metadata = result.metadata || {};
  const orderId = metadata.orderId || null;

  // Validate amount and currency against order if present
  if (orderId) {
    const orderRes = await d1Client.query(
      'SELECT id, payment_status, total, currency FROM orders WHERE id = ? OR short_id = ? LIMIT 1',
      [orderId, orderId]
    ).catch(() => ({ results: [] as any[] }));
    const order = orderRes.results?.[0];
    if (order) {
      const expectedAmount = Number(order.total);
      const expectedCurrency = String(order.currency || 'NGN').toUpperCase();
      if (Math.abs(expectedAmount - amountPaid) > 0.05) {
        return res.status(400).json({ success: false, error: 'Payment amount mismatch against order' });
      }
      if (currency !== expectedCurrency) {
        return res.status(400).json({ success: false, error: 'Payment currency mismatch against order' });
      }

      await d1Client.query(
        'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ? OR short_id = ?',
        ['paid', nowIso, order.id, order.id]
      ).catch((e) => console.error('[Payments verify] Order update error:', e));
    }
  }

  // Update transaction status
  await d1Client.query(
    'UPDATE transactions SET status = ?, amount = ?, currency = ? WHERE reference = ?',
    ['completed', amountPaid, currency, reference]
  ).catch(async () => {
    // If not existing, insert
    const txId = `txn-paystack-${Date.now()}`;
    await d1Client.query(
      'INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, orderId, reference, amountPaid, currency, 'completed', 'Paystack Online', nowIso]
    ).catch((e) => console.error('[Payments verify] Tx insert error:', e));
  });

  return res.json({
    success: true,
    isPaid: true,
    status: 'success',
    data: {
      reference,
      amountNGN: amountPaid,
      currency,
      orderId,
      customerEmail: result.customerEmail
    }
  });
}

/** GET /api/payments/verify or /api/payment/verify */
router.get('/verify', async (req: Request, res: Response) => {
  const reference = String(req.query.reference || req.query.trxref || '').trim();
  return handleVerify(reference, res);
});

/** POST /api/payments/verify or /api/payment/verify */
router.post('/verify', async (req: Request, res: Response) => {
  const reference = String(req.body?.reference || req.body?.trxref || req.query?.reference || '').trim();
  return handleVerify(reference, res);
});

/** GET — live D1 only; never invent account numbers */
router.get('/virtual-account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const va = await loadVirtualAccountFromD1(req.user!.id);
    if (!va) {
      return res.status(404).json({
        success: false,
        error: 'No virtual account yet',
        data: null
      });
    }
    return res.json({ success: true, data: va });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message });
  }
});

/** POST — create Paystack DVA and store in user_virtual_accounts */
router.post('/virtual-account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const secret =
      process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || '';
    if (!secret) {
      return res.status(503).json({
        success: false,
        error: 'Payment gateway not configured'
      });
    }

    const existing = await loadVirtualAccountFromD1(user.id);
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const customerRes = await fetch('https://api.paystack.co/customer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        first_name: (user.name || 'Customer').split(' ')[0],
        last_name: (user.name || 'User').split(' ').slice(1).join(' ') || 'VeyraNG',
        phone: user.phone || undefined
      })
    });
    const customerJson: any = await customerRes.json().catch(() => ({}));
    let customerCode = customerJson?.data?.customer_code as string | undefined;
    if (!customerCode) {
      const getCust = await fetch(
        `https://api.paystack.co/customer/${encodeURIComponent(user.email)}`,
        { headers: { Authorization: `Bearer ${secret}` } }
      );
      const getJson: any = await getCust.json().catch(() => ({}));
      customerCode = getJson?.data?.customer_code;
    }
    if (!customerCode) {
      return res.status(400).json({
        success: false,
        error: customerJson?.message || 'Could not create Paystack customer'
      });
    }

    const preferredBank = process.env.PAYSTACK_DVA_BANK || 'wema-bank';
    const dvaRes = await fetch('https://api.paystack.co/dedicated_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: customerCode,
        preferred_bank: preferredBank
      })
    });
    const dvaJson: any = await dvaRes.json().catch(() => ({}));
    if (!dvaRes.ok || !dvaJson?.status || !dvaJson?.data?.account_number) {
      return res.status(400).json({
        success: false,
        error:
          dvaJson?.message ||
          'Dedicated virtual account not available. Enable DVA on Paystack or use Online Payment.'
      });
    }

    const accountNumber = String(dvaJson.data.account_number);
    const bankName = dvaJson.data.bank?.name || 'Wema Bank';
    const accountName =
      dvaJson.data.account_name || `VeyraNG / ${user.name || 'Customer'}`;
    const dedicatedId =
      dvaJson.data.id != null ? String(dvaJson.data.id) : null;
    const nowIso = new Date().toISOString();
    const rowId = `uva-${user.id}`;

    await d1Client.query(
      `INSERT INTO user_virtual_accounts (
         id, user_id, account_number, bank_name, account_name, provider,
         provider_customer_code, provider_dedicated_id, is_active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'paystack', ?, ?, 1, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         account_number = excluded.account_number,
         bank_name = excluded.bank_name,
         account_name = excluded.account_name,
         provider_customer_code = excluded.provider_customer_code,
         provider_dedicated_id = excluded.provider_dedicated_id,
         is_active = 1,
         updated_at = excluded.updated_at`,
      [
        rowId,
        user.id,
        accountNumber,
        bankName,
        accountName,
        customerCode,
        dedicatedId,
        nowIso,
        nowIso
      ]
    );

    await d1Client
      .query(
        `UPDATE users SET virtual_account_number = ?, virtual_bank_name = ?, virtual_account_name = ?, updated_at = ? WHERE id = ?`,
        [accountNumber, bankName, accountName, nowIso, user.id]
      )
      .catch(() => {});

    return res.json({
      success: true,
      data: { accountNumber, bankName, accountName }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Virtual account error'
    });
  }
});

export default router;
