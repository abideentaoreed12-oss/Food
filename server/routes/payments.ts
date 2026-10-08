import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
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
  metadata: z.record(z.any()).optional()
});

/** Initialize official Paystack checkout (wallet top-up or order) */
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

/** Create or return Paystack Dedicated Virtual Account for the logged-in user (stored in D1) */
router.post('/virtual-account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const secret = process.env.PAYSTACK_SECRET_KEY || process.env.PAYMENT_SECRET_KEY || '';
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Payment gateway not configured' });
    }

    // Already have VA in D1?
    const existing = await d1Client.query(
      'SELECT virtual_account_number, virtual_bank_name, virtual_account_name FROM users WHERE id = ? LIMIT 1',
      [user.id]
    ).catch(() => ({ results: [] as any[] }));

    const row = existing.results?.[0];
    if (row?.virtual_account_number && row?.virtual_bank_name) {
      return res.json({
        success: true,
        data: {
          accountNumber: row.virtual_account_number,
          bankName: row.virtual_bank_name,
          accountName: row.virtual_account_name || `VeyraNG / ${user.name}`
        }
      });
    }

    // Ensure Paystack customer
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
    if (!customerCode && customerJson?.message?.includes('Customer already exists')) {
      const getCust = await fetch(`https://api.paystack.co/customer/${encodeURIComponent(user.email)}`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      const getJson: any = await getCust.json().catch(() => ({}));
      customerCode = getJson?.data?.customer_code;
    }
    if (!customerCode) {
      return res.status(400).json({
        success: false,
        error: customerJson?.message || 'Could not create Paystack customer for virtual account'
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
    const bankName = dvaJson.data.bank?.name || 'Wema Bank (Paystack DVA)';
    const accountName = dvaJson.data.account_name || `VeyraNG / ${user.name}`;

    await d1Client
      .query(
        `UPDATE users SET virtual_account_number = ?, virtual_bank_name = ?, virtual_account_name = ?, updated_at = ? WHERE id = ?`,
        [accountNumber, bankName, accountName, new Date().toISOString(), user.id]
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

router.get('/virtual-account', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await d1Client.query(
      'SELECT virtual_account_number, virtual_bank_name, virtual_account_name FROM users WHERE id = ? LIMIT 1',
      [req.user!.id]
    ).catch(() => ({ results: [] as any[] }));
    const row = existing.results?.[0];
    if (!row?.virtual_account_number) {
      return res.status(404).json({ success: false, error: 'No virtual account yet. Generate one first.' });
    }
    return res.json({
      success: true,
      data: {
        accountNumber: row.virtual_account_number,
        bankName: row.virtual_bank_name,
        accountName: row.virtual_account_name
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
