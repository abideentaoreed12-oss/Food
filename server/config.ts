import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch {
  // Silent fallback
}

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: process.env.APP_URL || 'https://veyrang.com',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://veyrang.com,https://www.veyrang.com',

  // JWT Secret - REQUIRED
  JWT_SECRET: process.env.JWT_SECRET || '',

  // Admin Credentials - REQUIRED
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  // Cloudflare D1 & Edge Workers
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID || '',
  CLOUDFLARE_DATABASE_NAME: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL || '',

  // Cloudflare R2 Production Storage
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',

  // Payment Webhooks
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || '',

  // Resend Email Delivery
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  // Google Maps Platform API
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ''
};
