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

// Zero hardcodes. All secrets and admin credentials must come from environment.
const jwtSecret = process.env.JWT_SECRET || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',

  JWT_SECRET: jwtSecret,

  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,

  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID || '',
  CLOUDFLARE_DATABASE_NAME: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_AUTH_EMAIL: process.env.CLOUDFLARE_AUTH_EMAIL || '',
  CLOUDFLARE_WORKER_URL: (process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, ''),
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',

  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  CLOUDFLARE_R2_PUBLIC_URL: (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, ''),

  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || process.env.PAYSTACK_WEBHOOK_SECRET || '',

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  GOOGLE_MAPS_API_KEY:
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '',
  NOMINATIM_BASE_URL: (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
  PHOTON_BASE_URL: (process.env.PHOTON_BASE_URL || 'https://photon.komoot.io').replace(/\/$/, ''),
  PELIAS_BASE_URL: (process.env.PELIAS_BASE_URL || '').replace(/\/$/, ''),
  PELIAS_API_KEY: process.env.PELIAS_API_KEY || '',
  OSRM_BASE_URL: (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, ''),
  VALHALLA_BASE_URL: (process.env.VALHALLA_BASE_URL || '').replace(/\/$/, ''),
  VALHALLA_API_KEY: process.env.VALHALLA_API_KEY || '',
  GRAPHHOPPER_API_KEY: process.env.GRAPHHOPPER_API_KEY || '',
  OPENROUTESERVICE_API_KEY: process.env.OPENROUTESERVICE_API_KEY || ''
};
