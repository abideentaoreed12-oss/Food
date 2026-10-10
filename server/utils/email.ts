import { CONFIG } from '../config.ts';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  hostHeader?: string;
}

/**
 * Sends email via Resend. Never reports success when delivery was not accepted by Resend.
 * Final delivery status (delivered / bounced / failed) is confirmed by
 * POST /api/webhooks/resend (official Svix signature verification).
 */
export async function sendEmail({ to, subject, html, text, hostHeader }: SendEmailParams) {
  const apiKey = (CONFIG.RESEND_API_KEY || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    console.error(`[Email] RESEND_API_KEY not configured — cannot send to ${to}`);
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server',
    };
  }

  const domain = 'veyrang.com';
  const senderEmail = `noreply@${domain}`;
  const fromName = (CONFIG.EMAIL_SENDER_NAME || 'Veyrang').trim() || 'Veyrang';

  console.log(`[EMAIL DISPATCH] To: ${to} | Subject: ${subject}`);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${senderEmail}>`,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({} as any));
      const message = errBody?.message || errBody?.error || `Resend HTTP ${res.status}`;
      console.error('[Email] Resend API error:', errBody);
      return { success: false, error: message, status: res.status };
    }

    const data = await res.json();
    const id = data?.id || data?.data?.id;
    console.log(`[Email] Accepted by Resend. To: ${to} ID: ${id || 'unknown'}`);
    // Accepted by API only — delivery is confirmed asynchronously via /api/webhooks/resend
    return { success: true, id, accepted: true };
  } catch (err: any) {
    console.error(`[Email] Failed To: ${to} — ${err?.message || err}`);
    return { success: false, error: err?.message || 'Email dispatch failed' };
  }
}
