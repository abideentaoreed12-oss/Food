import crypto from 'crypto';
import { d1Client } from '../server/db/d1Client';

export interface PaystackVerifyResult {
  success: boolean;
  isPaid: boolean;
  status: string;
  reference: string;
  amountNGN: number;
  currency: string;
  gatewayResponse?: string;
  paidAt?: string;
  channel?: string;
  customer?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  customerEmail?: string;
  metadata?: Record<string, any>;
  orderId?: string | null;
  userId?: string | null;
  error?: string;
  raw?: any;
}

export interface LiveGateOptions {
  expectedAmountNGN?: number;
  expectedCurrency?: string;
  orderId?: string;
  userId?: string;
  applyDatabaseUpdates?: boolean;
}

export class PaystackLiveGate {
  /**
   * Official Paystack Secret Key (Bearer auth for REST endpoints & HMAC key for webhooks)
   */
  private getSecretKey(): string {
    return (process.env.PAYSTACK_SECRET_KEY || '').trim();
  }

  /**
   * Official Paystack Public Key
   */
  public getPublicKey(): string {
    return (
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
      'pk_live_49b0196c7c50a9138e64d0a169ea5cced6ff14f0'
    ).trim();
  }

  /**
   * Official Callback URL
   */
  public getCallbackUrl(): string {
    return (
      process.env.PAYSTACK_CALLBACK_URL ||
      'https://www.veyrang.com/payment/callback'
    ).trim();
  }

  /**
   * Official Webhook URL
   */
  public getWebhookUrl(): string {
    return (
      process.env.PAYSTACK_WEBHOOK_URL ||
      'https://www.veyrang.com/api/webhooks/paystack'
    ).trim();
  }

  /**
   * Returns current gate configuration diagnostics
   */
  public getStatus() {
    const secret = this.getSecretKey();
    const isConfigured = secret.length > 0;
    const isLive = secret.startsWith('sk_live_');
    const isTest = secret.startsWith('sk_test_');

    return {
      configured: isConfigured,
      mode: isLive ? 'live' : isTest ? 'test' : isConfigured ? 'custom' : 'missing_secret',
      publicKey: this.getPublicKey(),
      callbackUrl: this.getCallbackUrl(),
      webhookUrl: this.getWebhookUrl(),
      officialDocs: 'https://paystack.com/docs/api/transaction/#verify'
    };
  }

  /**
   * Verifies an incoming webhook payload using the official Paystack HMAC SHA512 signature.
   */
  public verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    const secret = this.getSecretKey();
    if (!secret || !signature || !rawBody) {
      return false;
    }

    try {
      const computedHash = crypto
        .createHmac('sha512', secret)
        .update(rawBody)
        .digest('hex');

      // Constant time comparison to prevent timing attacks
      if (computedHash.length !== signature.length) {
        return false;
      }
      return crypto.timingSafeEqual(
        Buffer.from(computedHash, 'utf-8'),
        Buffer.from(signature, 'utf-8')
      );
    } catch (err) {
      console.error('[Paystack Live Gate] Error checking signature:', err);
      return false;
    }
  }

  /**
   * Live Verification Gate:
   * Directly calls the official Paystack transaction verification endpoint:
   * GET https://api.paystack.co/transaction/verify/:reference
   */
  public async verifyTransaction(
    reference: string,
    options: LiveGateOptions = {}
  ): Promise<PaystackVerifyResult> {
    const trimmedRef = (reference || '').trim();
    if (!trimmedRef) {
      return {
        success: false,
        isPaid: false,
        status: 'invalid_reference',
        reference: '',
        amountNGN: 0,
        currency: 'NGN',
        error: 'Missing payment reference'
      };
    }

    const secretKey = this.getSecretKey();
    if (!secretKey) {
      return {
        success: false,
        isPaid: false,
        status: 'unconfigured',
        reference: trimmedRef,
        amountNGN: 0,
        currency: 'NGN',
        error: 'PAYSTACK_SECRET_KEY is not configured on the server. Please add your live secret key.'
      };
    }

    try {
      const endpoint = `https://api.paystack.co/transaction/verify/${encodeURIComponent(trimmedRef)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store'
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok || !json.status || !json.data) {
        const errorMsg = json.message || `Paystack responded with status ${response.status}`;
        console.warn(`[Paystack Live Gate] Verification failed for ref ${trimmedRef}:`, errorMsg);
        return {
          success: false,
          isPaid: false,
          status: json?.data?.status || 'failed',
          reference: trimmedRef,
          amountNGN: 0,
          currency: 'NGN',
          error: errorMsg,
          raw: json
        };
      }

      const data = json.data;
      const isPaid = data.status === 'success';
      const amountNGN = (Number(data.amount) || 0) / 100;
      const currency = String(data.currency || 'NGN').toUpperCase();
      const metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {};
      const orderId = options.orderId || metadata.orderId || metadata.order_id || null;
      const userId = options.userId || metadata.userId || metadata.user_id || null;

      // Validate amount match if expected amount was provided
      if (typeof options.expectedAmountNGN === 'number' && options.expectedAmountNGN > 0) {
        const diff = Math.abs(options.expectedAmountNGN - amountNGN);
        if (diff > 0.05) {
          console.error(`[Paystack Live Gate] Amount mismatch: Expected NGN ${options.expectedAmountNGN}, received NGN ${amountNGN}`);
          return {
            success: false,
            isPaid: false,
            status: 'amount_mismatch',
            reference: trimmedRef,
            amountNGN,
            currency,
            orderId,
            userId,
            error: `Payment amount mismatch: Expected ₦${options.expectedAmountNGN.toLocaleString()}, received ₦${amountNGN.toLocaleString()}`,
            raw: data
          };
        }
      }

      // Validate currency
      const expectedCurr = (options.expectedCurrency || 'NGN').toUpperCase();
      if (currency !== expectedCurr) {
        console.error(`[Paystack Live Gate] Currency mismatch: Expected ${expectedCurr}, received ${currency}`);
        return {
          success: false,
          isPaid: false,
          status: 'currency_mismatch',
          reference: trimmedRef,
          amountNGN,
          currency,
          orderId,
          userId,
          error: `Payment currency mismatch: Expected ${expectedCurr}, received ${currency}`,
          raw: data
        };
      }

      const result: PaystackVerifyResult = {
        success: true,
        isPaid,
        status: data.status,
        reference: data.reference || trimmedRef,
        amountNGN,
        currency,
        gatewayResponse: data.gateway_response,
        paidAt: data.paid_at,
        channel: data.channel,
        customer: {
          email: data.customer?.email,
          phone: data.customer?.phone,
          name: [data.customer?.first_name, data.customer?.last_name].filter(Boolean).join(' ') || undefined
        },
        customerEmail: data.customer?.email,
        metadata,
        orderId,
        userId,
        raw: data
      };

      // Perform idempotent database updates if enabled (default true)
      if (options.applyDatabaseUpdates !== false && isPaid) {
        await this.syncDatabaseState(result);
      }

      return result;
    } catch (err: any) {
      console.error(`[Paystack Live Gate] Verification error for ref ${trimmedRef}:`, err?.message || err);
      return {
        success: false,
        isPaid: false,
        status: 'network_error',
        reference: trimmedRef,
        amountNGN: 0,
        currency: 'NGN',
        error: err?.message || 'Error communicating with Paystack verification API'
      };
    }
  }

  /**
   * Idempotently updates orders, transactions, and wallets in D1
   */
  private async syncDatabaseState(verifyResult: PaystackVerifyResult): Promise<void> {
    const { reference, amountNGN, currency, orderId, userId, metadata, paidAt } = verifyResult;
    const nowIso = paidAt || new Date().toISOString();

    try {
      // 1. Update Order payment status if orderId exists
      if (orderId) {
        const orderQuery = await d1Client.query(
          'SELECT id, payment_status, total FROM orders WHERE id = ? OR short_id = ? LIMIT 1',
          [orderId, orderId]
        ).catch(() => ({ results: [] }));

        const order = orderQuery.results?.[0];
        if (order && order.payment_status !== 'paid') {
          await d1Client.query(
            'UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ? OR short_id = ?',
            ['paid', nowIso, order.id, order.id]
          ).catch((e) => console.error('[Paystack Live Gate] Failed to update order status:', e));
          console.log(`[Paystack Live Gate] Order ${order.id} marked as paid`);
        }
      }

      // 2. Insert or update transaction record
      const txQuery = await d1Client.query(
        'SELECT id, status FROM transactions WHERE reference = ? LIMIT 1',
        [reference]
      ).catch(() => ({ results: [] }));

      const existingTx = txQuery.results?.[0];
      if (existingTx) {
        if (existingTx.status !== 'completed') {
          await d1Client.query(
            'UPDATE transactions SET status = ?, amount = ?, currency = ? WHERE reference = ?',
            ['completed', amountNGN, currency, reference]
          ).catch(() => {});
        }
      } else {
        const txId = `txn-paystack-${Date.now()}`;
        await d1Client.query(
          `INSERT INTO transactions (id, order_id, reference, amount, currency, status, payment_method, created_at)
           VALUES (?, ?, ?, ?, ?, 'completed', 'Paystack', ?)`,
          [txId, orderId || null, reference, amountNGN, currency, nowIso]
        ).catch(() => {});
      }

      // 3. Process wallet topup if applicable
      const isWalletTopup = metadata?.type === 'wallet_topup' || (!orderId && userId);
      if (isWalletTopup && userId) {
        const existingWallet = await d1Client.query(
          'SELECT id, status FROM wallet_transactions WHERE reference = ? LIMIT 1',
          [reference]
        ).catch(() => ({ results: [] }));

        if (!existingWallet.results?.length) {
          const walletTxId = `wtx-${Date.now()}`;
          await d1Client.query(
            `INSERT INTO wallet_transactions (id, user_id, amount, type, reference, status, description, created_at)
             VALUES (?, ?, ?, 'credit', ?, 'completed', 'Paystack Live Top-up', ?)`,
            [walletTxId, userId, amountNGN, reference, nowIso]
          ).catch(() => {});

          await d1Client.query(
            'UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?',
            [amountNGN, userId]
          ).catch(() => {});
          console.log(`[Paystack Live Gate] Wallet credited with ₦${amountNGN} for user ${userId}`);
        }
      }
    } catch (syncErr) {
      console.error('[Paystack Live Gate] Error syncing database records:', syncErr);
    }
  }
}

export const paystackLiveGate = new PaystackLiveGate();
