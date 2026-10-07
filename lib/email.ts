import { Resend } from 'resend';
import nodemailer from 'nodemailer';

export async function sendVerificationEmail({
  to,
  code,
  type = 'signup',
}: {
  to: string;
  code: string;
  type?: 'signup' | 'forgot_password';
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'abideentaoreed12@gmail.com';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

  const subject = type === 'signup'
    ? 'Verify Your Email Address - Veyrang Food Express'
    : 'Reset Your Password - Veyrang Food Express';

  const title = type === 'signup'
    ? 'Email Verification Code'
    : 'Password Reset Request';

  const description = type === 'signup'
    ? 'Thank you for signing up with Veyrang Food Express. Please enter the 6-digit verification code below to verify your email address and activate your account:'
    : 'We received a request to reset the password for your Veyrang Food Express account. Enter the 6-digit verification code below to reset your password:';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
        .header { background: #0f172a; padding: 28px 24px; text-align: center; }
        .brand { font-size: 22px; font-weight: 900; color: #ff5500; letter-spacing: -0.5px; text-transform: uppercase; }
        .brand-accent { color: #ffffff; }
        .body { padding: 32px 28px; text-align: center; }
        .h1 { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; }
        .p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
        .code-container { background-color: #fff7ed; border: 2px dashed #ff5500; border-radius: 12px; padding: 20px; display: inline-block; margin: 0 auto 24px auto; }
        .code-text { font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; color: #ff5500; letter-spacing: 10px; margin: 0; }
        .expiry { font-size: 12px; color: #64748b; margin: 0; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="brand">VEYRANG <span class="brand-accent">EXPRESS</span></div>
        </div>
        <div class="body">
          <h1 class="h1">${title}</h1>
          <p class="p">${description}</p>
          <div class="code-container">
            <p class="code-text">${code}</p>
          </div>
          <p class="expiry">This verification code expires in 15 minutes. If you did not request this email, please ignore it.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Veyrang Food Express. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // Option 1: Try Resend API if RESEND_API_KEY is configured
  if (apiKey && apiKey.startsWith('re_') && apiKey !== 're_123456789' && apiKey !== 're_your_resend_api_key') {
    try {
      const resend = new Resend(apiKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'Veyrang Food Express <onboarding@resend.dev>';
      const data = await resend.emails.send({
        from: fromEmail,
        to: [to],
        subject,
        html,
      });
      console.log(`[Resend Email Success] Code ${code} sent to ${to}. ID: ${data.data?.id}`);
      return { success: true, method: 'resend', data };
    } catch (err: any) {
      console.error(`[Resend Email Error] Failed to dispatch via Resend to ${to}:`, err);
    }
  }

  // Option 2: Try Nodemailer SMTP if SMTP_PASS / GMAIL_APP_PASSWORD is set
  if (smtpPass && smtpPass.trim() !== '') {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"Veyrang Food Express" <${smtpUser}>`,
        to,
        subject,
        html,
      });

      console.log(`[SMTP Email Success] Code ${code} sent to ${to} via SMTP. ID: ${info.messageId}`);
      return { success: true, method: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      console.error(`[SMTP Email Error] Failed to dispatch via SMTP to ${to}:`, err);
    }
  }

  // Fallback: Notice if credentials need to be set in .env
  console.warn(`[Email Dispatch Warning] Neither RESEND_API_KEY nor SMTP_PASS are set with valid production credentials in .env. Code ${code} for ${to} stored in Cloudflare D1.`);
  return {
    success: false,
    error: 'Email delivery service requires RESEND_API_KEY or SMTP_PASS (Gmail App Password) in environment variables.',
  };
}
