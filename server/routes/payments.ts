import { Router, Response } from 'express';
import { z } from 'zod';
import { d1Client } from '../db/d1Client.ts';
import { validateBody } from '../middleware/validate.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { paymentGateway } from '../../lib/payment.ts';
import { CONFIG } from '../config.ts';

const router = Router();

const InitializeSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional()
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

/** Initialize official Paystack checkout */
router.post('/initialize', requireAuth, validateBody(InitializeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, amount, callbackUrl, metadata } = req.body;
    const userId = req.user!.id;

    const result = await paymentGateway.initializePayment({
      email,
      amountNGN: amount,
      callbackUrl: callbackUrl || `${CONFIG.APP_URL}/payment/callback`,
      metadata: { ...metadata, userId }
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Paystack initialize failed' });
    }

    const nowIso = new Date().toISOString();
    await d1Client
      .query(
        `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
         VALUES (?, ?, ?, ?, 'NGN', 'pending', 'Paystack', ?)`,
        [`txn-init-${Date.now()}`, metadata?.orderId || null, result.reference, amount, nowIso]
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
    return res.status(500).json({ success: false, error: error.message || 'Payment init error' });
  }
});

/** GET — only from live D1 table user_virtual_accounts. No hardcoded fallback. */
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
    return res.status(500).json({ success: false, error: error.message });
  }
});

/** POST — create Paystack DVA once, store only in user_virtual_accounts */
router.post('/virtual-account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || '';
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Payment gateway not configured' });
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
    let customerCode = customerJson?.data?.customer_code;
    if (!customerCode) {
      const getCust = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(user.email)}`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
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
    const accountName = dvaJson.data.account_name || `VeyraNG / ${user.name || 'Customer'}`;
    const dedicatedId = dvaJson.data.id != null ? String(dvaJson.data.id) : null;
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
      [rowId, user.id, accountNumber, bankName, accountName, customerCode, dedicatedId, nowIso, nowIso]
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
    return res.status(500).json({ success: false, error: error.message || 'Virtual account error' });
  }
});

export default router;
