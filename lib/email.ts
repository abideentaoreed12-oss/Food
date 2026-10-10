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
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);

  const subject = type === 'signup'
    ? 'Verify Your Email Address - Veyrang Food Express'
    : 'Reset Your Password - Veyrang Food Express';

  const title = type === 'signup'
    ? 'Welcome to Veyrang Food Express!'
    : 'Password Reset Verification';

  const description = type === 'signup'
    ? 'Thank you for creating an account with Veyrang Food Express. To complete your registration and start ordering delicious meals, please use the secure verification code below:'
    : 'We received a request to reset the password for your Veyrang Food Express account. Please use the secure verification code below to proceed with resetting your password:';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f1f5f9;
          margin: 0;
          padding: 32px 16px;
          color: #0f172a;
        }
        .wrapper {
          width: 100%;
          table-layout: fixed;
          background-color: #f1f5f9;
          padding-bottom: 40px;
        }
        .card {
          max-width: 560px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 12px 30px -10px rgba(15, 23, 42, 0.08);
        }
        .header {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 36px 32px;
          text-align: center;
          border-bottom: 4px solid #ff5500;
        }
        .logo-badge {
          display: inline-block;
          background: rgba(255, 85, 0, 0.15);
          color: #ff5500;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          padding: 6px 14px;
          border-radius: 30px;
          margin-bottom: 12px;
        }
        .brand {
          font-size: 26px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.5px;
          margin: 0;
          text-transform: uppercase;
        }
        .brand span {
          color: #ff5500;
        }
        .body {
          padding: 40px 36px;
          text-align: center;
        }
        .h1 {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 14px 0;
          letter-spacing: -0.3px;
        }
        .p {
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
          margin: 0 0 32px 0;
        }
        .code-box {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border: 2px dashed #ff5500;
          border-radius: 16px;
          padding: 24px;
          margin: 0 auto 32px auto;
          display: inline-block;
          min-width: 240px;
        }
        .code-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #c2410c;
          letter-spacing: 1.5px;
          margin: 0 0 8px 0;
        }
        .code-text {
          font-family: 'Courier New', Courier, monospace;
          font-size: 38px;
          font-weight: 900;
          color: #c2410c;
          letter-spacing: 10px;
          margin: 0;
        }
        .expiry {
          font-size: 13px;
          color: #64748b;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 10px;
          margin: 0 0 24px 0;
          border: 1px solid #e2e8f0;
        }
        .security-note {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px 32px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer-links {
          margin-bottom: 8px;
        }
        .footer-links a {
          color: #ff5500;
          text-decoration: none;
          margin: 0 10px;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="card">
          <div class="header">
            <div class="logo-badge">Secure Verification</div>
            <h2 class="brand">Veyrang <span>Express</span></h2>
          </div>
          <div class="body">
            <h1 class="h1">${title}</h1>
            <p class="p">${description}</p>
            <div class="code-box">
              <div class="code-label">Your 6-Digit Verification Code</div>
              <p class="code-text">${code}</p>
            </div>
            <div class="expiry">
              ⏱️ This code expires in <strong>15 minutes</strong> for your security.
            </div>
            <p class="security-note">
              If you did not request this verification code, please ignore this email or contact our support team immediately. Never share your verification code with anyone.
            </p>
          </div>
          <div class="footer">
            <div class="footer-links">
              <a href="https://veyrang.com" target="_blank">Visit Website</a> &bull;
              <a href="https://veyrang.com/support" target="_blank">Support Center</a>
            </div>
            &copy; ${new Date().getFullYear()} Veyrang Food Express. All rights reserved.<br>
            Delivering culinary excellence straight to your doorstep.
          </div>
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
      if (data.error) {
        console.warn(`[Resend Email Warning] Resend API returned error for ${to}:`, data.error);
      } else {
        console.log(`[Resend Email Success] Code ${code} sent to ${to}. ID: ${data.data?.id}`);
        return { success: true, method: 'resend', data };
      }
    } catch (err: any) {
      console.error(`[Resend Email Error] Failed to dispatch via Resend to ${to}:`, err);
    }
  }

  // Option 2: Try Nodemailer SMTP (Automatic Gmail SMTP Fallback)
  if (smtpPass && smtpPass.trim() !== '') {
    try {
      const isSecure = smtpPort === 465 || smtpHost === 'smtp.gmail.com';
      const senderName = process.env.EMAIL_SENDER_NAME || 'Veyrang Support';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: isSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${senderName}" <${smtpUser}>`,
        to,
        subject,
        html,
      });

      console.log(`[SMTP Email Success] Code ${code} sent to ${to} via Gmail/SMTP. ID: ${info.messageId}`);
      return { success: true, method: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      console.error(`[SMTP Email Error] Failed to dispatch via SMTP to ${to}:`, err);
    }
  }

  // Fallback: Notice if credentials need to be set in environment secrets
  console.warn(`[Email Dispatch Warning] Neither RESEND_API_KEY nor GMAIL_APP_PASSWORD (SMTP_PASS) are set in secrets. Code ${code} for ${to} stored in Cloudflare D1.`);
  return {
    success: false,
    error: 'Email delivery service requires GMAIL_USER and GMAIL_APP_PASSWORD (or RESEND_API_KEY) in secrets.',
  };
}
