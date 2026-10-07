// Unified Server & Cloud Configuration
// Loads from process.env with safe built-in production fallbacks.
// NEVER requires creating or modifying a physical .env file in the workspace.

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// If a .env file exists, load it quietly without throwing; otherwise use process.env / fallbacks
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

  // JWT Secret
  JWT_SECRET: process.env.JWT_SECRET || 'veyrang-super-secure-production-jwt-key-2026',

  // Admin Credentials
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'abideentaoreed12@gmail.com').toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Teeplus1029',

  // Cloudflare D1 & Edge Workers
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '661a09bca00f369ea7301c3b6c9e6b6b',
  CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID || 'bfaade8e-23b9-4678-a8b3-c4bd87d510ea',
  CLOUDFLARE_DATABASE_NAME: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || 'cfut_vOu5Jq16qNQHqDQEWkP3zue6RafeGzQeMhNdd94M6b9c61f3',
  CLOUDFLARE_WORKER_URL: process.env.CLOUDFLARE_WORKER_URL || 'https://veyrang-api.abideentaoreed12.workers.dev',

  // Cloudflare R2 Production Storage
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || 'veyrang-production-storage',
  CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.veyrang.com',
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '50308daffd2c12dd77d210ec3ba63f50',

  // Payment Webhooks
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || 'whsec_veyrang_production_secret_2026',

  // Resend Email Delivery
  RESEND_API_KEY: process.env.RESEND_API_KEY || 're_SG1Bhpu1_88GeqCL8p9yFnvBbkX2BcEWC',

  // Google Maps Platform API
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw'
};
