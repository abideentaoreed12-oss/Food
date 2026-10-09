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

const jwtSecret = process.env.JWT_SECRET || '';
// Do NOT throw at module load — Next.js sets NODE_ENV=production during `next build`
// and importing CONFIG would crash the entire compile. Enforce JWT at request time instead.
if (process.env.NODE_ENV === 'production' && !jwtSecret && process.env.VERCEL_ENV === 'production') {
  console.warn('[CONFIG] JWT_SECRET is empty in production runtime — auth tokens will fail until set.');
}

export const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  APP_URL: process.env.APP_URL || 'https://veyrang.com',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'https://veyrang.com,https://www.veyrang.com',

  JWT_SECRET: jwtSecret,

  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_DATABASE_ID: process.env.CLOUDFLARE_DATABASE_ID || '',
  CLOUDFLARE_DATABASE_NAME: process.env.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
  // Separate scoped credentials are preferred; legacy token remains a backwards-compatible fallback.
  CLOUDFLARE_D1_API_TOKEN: process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_R2_API_TOKEN: process.env.CLOUDFLARE_R2_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_WORKER_URL: (process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, ''),
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',

  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  CLOUDFLARE_R2_PUBLIC_URL: (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, ''),

  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || '',

  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  GOOGLE_MAPS_API_KEY:
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '',
  // Optional, operator-managed geocoding/routing endpoints and provider credentials.
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
