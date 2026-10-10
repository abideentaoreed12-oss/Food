// Unified Payment Gateway Client (Server-Side)
// Handles live card, bank transfer, and USSD transaction initialization, verification, and webhooks.

export interface InitializePaymentParams {
  email: string;
  amountNGN: number;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentInitializationResult {
  success: boolean;
  authorizationUrl?: string;
  accessCode?: string;
  reference: string;
  error?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  isPaid: boolean;
  status: string;
  amountNGN: number;
  reference: string;
  currency?: string;
  metadata?: Record<string, any>;
  gatewayResponse?: string;
  customerEmail?: string;
  raw?: any;
  error?: string;
}

export class PaymentGatewayClient {
  private secretKey: string;

  constructor() {
    this.secretKey =
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYMENT_SECRET_KEY ||
      '';
  }

  private getSecretKey(): string {
    return (
      process.env.PAYSTACK_SECRET_KEY ||
      process.env.PAYMENT_SECRET_KEY ||
      this.secretKey ||
      ''
    );
  }

  public async initializePayment(params: InitializePaymentParams): Promise<PaymentInitializationResult> {
    const key = this.getSecretKey();
    if (!key) {
      return {
        success: false,
        reference: params.reference || '',
        error: 'PAYSTACK_SECRET_KEY is not configured on the server.'
      };
    }
    const ref = params.reference || `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const amountKobo = Math.round(params.amountNGN * 100);

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: params.email,
          amount: amountKobo,
          reference: ref,
          callback_url: params.callbackUrl,
          metadata: params.metadata || {}
        }),
        cache: 'no-store'
      });

      const json = await response.json().catch(() => ({}));
      if (response.ok && json.status && json.data) {
        return {
          success: true,
          authorizationUrl: json.data.authorization_url,
          accessCode: json.data.access_code,
          reference: json.data.reference || ref
        };
      }

      return {
        success: false,
        reference: ref,
        error: json.message || `Initialization failed (${response.status})`
      };
    } catch (err: any) {
      console.error('[Payment Gateway Initialization Error]:', err?.message || err);
      return {
        success: false,
        reference: ref,
        error: err?.message || 'Payment server request error'
      };
    }
  }

  public async verifyPayment(reference: string): Promise<PaymentVerificationResult> {
    const key = this.getSecretKey();
    if (!key) {
      return {
        success: false,
        isPaid: false,
        status: 'error',
        amountNGN: 0,
        reference,
        error: 'PAYSTACK_SECRET_KEY is not configured on the server.'
      };
    }
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        },
        cache: 'no-store'
      });

      const json = await response.json().catch(() => ({}));
      if (response.ok && json.status && json.data) {
        const isPaid = json.data.status === 'success';
        const amountNGN = (json.data.amount || 0) / 100;
        return {
          success: true,
          isPaid,
          status: json.data.status,
          amountNGN,
          currency: json.data.currency || 'NGN',
          metadata: json.data.metadata || {},
          gatewayResponse: json.data.gateway_response,
          reference: json.data.reference || reference,
          customerEmail: json.data.customer?.email,
          raw: json.data
        };
      }

      return {
        success: false,
        isPaid: false,
        status: 'error',
        amountNGN: 0,
        reference,
        error: json.message || 'Verification failed'
      };
    } catch (err: any) {
      console.error('[Payment Gateway Verification Error]:', err?.message || err);
      return {
        success: false,
        isPaid: false,
        status: 'error',
        amountNGN: 0,
        reference,
        error: err?.message || 'Verification server error'
      };
    }
  }
}

export const paymentGateway = new PaymentGatewayClient();
