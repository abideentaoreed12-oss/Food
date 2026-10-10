/**
 * Resend webhook endpoint — official verification via Resend SDK (Svix signatures).
 * Docs: https://resend.com/docs/webhooks/verify-webhooks-requests
 *
 * Env required: RESEND_WEBHOOK_SECRET (signing secret from Resend dashboard, starts with whsec_)
 * Endpoint to configure in Resend: https://veyrang.com/api/webhooks/resend
 *
 * MUST use raw request body (req.text()) — re-stringifying JSON breaks the signature.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { d1 } from '../../../../lib/d1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    created_at?: string;
    [key: string]: unknown;
  };
};

function getWebhookSecret(): string {
  return (
    process.env.RESEND_WEBHOOK_SECRET ||
    process.env.RESEND_WEBHOOK_SIGNING_SECRET ||
    ''
  ).trim();
}

export async function POST(req: NextRequest) {
  const secret = getWebhookSecret();
  if (!secret) {
    console.error('[Resend webhook] RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { success: false, error: 'RESEND_WEBHOOK_SECRET not configured' },
      { status: 503 }
    );
  }

  // Official requirement: raw body string for signature verification
  const payload = await req.text();

  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { success: false, error: 'Missing svix-id, svix-timestamp, or svix-signature headers' },
      { status: 400 }
    );
  }

  let event: ResendWebhookEvent;
  try {
    // Official Resend SDK verification (throws if invalid)
    // https://resend.com/docs/webhooks/verify-webhooks-requests
    const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_for_verify_only');
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret: secret,
    }) as ResendWebhookEvent;
  } catch (err: any) {
    console.error('[Resend webhook] Signature verification failed:', err?.message || err);
    return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 });
  }

  const eventType = String(event?.type || '');
  const data = event?.data || {};
  const emailId = String(data.email_id || '');
  const toRaw = data.to;
  const to = Array.isArray(toRaw) ? toRaw.join(',') : String(toRaw || '');
  const subject = String(data.subject || '');
  const now = new Date().toISOString();

  // Persist delivery lifecycle for verification / audit (idempotent on svix-id)
  try {
    await d1
      .query(
        `INSERT OR IGNORE INTO webhook_events (id, provider, event_type, reference, payload, created_at)
         VALUES (?, 'resend', ?, ?, ?, ?)`,
        [
          svixId,
          eventType,
          emailId || null,
          JSON.stringify({
            type: eventType,
            email_id: emailId || null,
            to: to || null,
            subject: subject || null,
            created_at: event.created_at || data.created_at || now,
          }),
          now,
        ]
      )
      .catch(async () => {
        await d1
          .query(
            `INSERT INTO audit_logs (id, user_id, user_email, user_role, action, resource, resource_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `resend-${svixId}`,
              'system',
              to || 'unknown',
              'system',
              `RESEND_${eventType.replace(/\./g, '_').toUpperCase()}`,
              'EMAIL',
              emailId || svixId,
              now,
            ]
          )
          .catch(() => {});
      });
  } catch (storeErr: any) {
    console.warn('[Resend webhook] Event store warning:', storeErr?.message || storeErr);
  }

  switch (eventType) {
    case 'email.sent':
      console.log(`[Resend] email.sent id=${emailId} to=${to}`);
      break;
    case 'email.delivered':
      console.log(`[Resend] email.delivered id=${emailId} to=${to}`);
      break;
    case 'email.delivery_delayed':
      console.warn(`[Resend] email.delivery_delayed id=${emailId} to=${to}`);
      break;
    case 'email.bounced':
    case 'email.failed':
    case 'email.complained':
    case 'email.suppressed':
      console.error(`[Resend] ${eventType} id=${emailId} to=${to} subject=${subject}`);
      break;
    default:
      console.log(`[Resend] event=${eventType} id=${emailId}`);
  }

  return NextResponse.json({ success: true, received: true, type: eventType });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/webhooks/resend',
    configured: Boolean(getWebhookSecret()),
    docs: 'https://resend.com/docs/webhooks/verify-webhooks-requests',
  });
}
