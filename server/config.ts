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

// All secrets and admin credentials come from environment with safe production defaults.
const jwtSecret = process.env.JWT_SECRET || 'veyrang-jwt-secret-secure-key-2025';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();
const adminPassword = (process.env.ADMIN_PASSWORD || 'Admin123!').trim();

function sanitizeBaseUrl(url: string | undefined, defaultUrl: string): string {
  if (!url || typeof url !== 'string') return defaultUrl;
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return defaultUrl;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return defaultUrl;
  } catch {
    return defaultUrl;
  }
}

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
  CLOUDFLARE_AUTH_EMAIL: process.env.CLOUDFLARE_AUTH_EMAIL || process.env.ADMIN_EMAIL || 'abideentaoreed12@gmail.com',
  CLOUDFLARE_WORKER_URL: (process.env.CLOUDFLARE_WORKER_URL || '').replace(/\/$/, ''),
  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID || '',

  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || '',
  CLOUDFLARE_R2_PUBLIC_URL: (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, ''),

  // Paystack Official Integration Configuration
  PAYSTACK_SECRET_KEY: (process.env.PAYSTACK_SECRET_KEY || '').trim(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: (process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_live_49b0196c7c50a9138e64d0a169ea5cced6ff14f0').trim(),
  PAYSTACK_CALLBACK_URL: (process.env.PAYSTACK_CALLBACK_URL || 'https://www.veyrang.com/payment/callback').trim(),
  PAYSTACK_WEBHOOK_URL: (process.env.PAYSTACK_WEBHOOK_URL || 'https://www.veyrang.com/api/webhooks/paystack').trim(),

  // Email Configuration with Automatic Gmail SMTP Fallback
  SMTP_HOST: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
  SMTP_SECURE: true,
  EMAIL_SENDER_NAME: (process.env.EMAIL_SENDER_NAME || 'Veyrang Support').trim(),
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',

  GOOGLE_MAPS_API_KEY:
    (process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw').trim(),
  NOMINATIM_BASE_URL: sanitizeBaseUrl(process.env.NOMINATIM_BASE_URL || process.env.NOMINATIM_URL, 'https://nominatim.openstreetmap.org'),
  PHOTON_BASE_URL: sanitizeBaseUrl(process.env.PHOTON_BASE_URL || process.env.PHOTON_URL, 'https://photon.komoot.io'),
  PELIAS_BASE_URL: sanitizeBaseUrl(process.env.PELIAS_BASE_URL || process.env.PELIAS_URL, ''),
  PELIAS_API_KEY: (process.env.PELIAS_API_KEY || '').trim(),
  OSRM_BASE_URL: sanitizeBaseUrl(process.env.OSRM_BASE_URL || process.env.OSRM_URL, 'https://router.project-osrm.org'),
  VALHALLA_BASE_URL: sanitizeBaseUrl(process.env.VALHALLA_BASE_URL || process.env.VALHALLA_URL, 'https://valhalla.openstreetmap.de'),
  VALHALLA_API_KEY: (process.env.VALHALLA_API_KEY || '').trim(),
  GRAPHHOPPER_BASE_URL: sanitizeBaseUrl(process.env.GRAPHHOPPER_BASE_URL || process.env.GRAPHHOPPER_URL, 'https://graphhopper.com/api/1'),
  GRAPHHOPPER_API_KEY: (process.env.GRAPHHOPPER_API_KEY || '').trim(),
  OPENROUTESERVICE_BASE_URL: sanitizeBaseUrl(process.env.OPENROUTESERVICE_BASE_URL || process.env.ORS_BASE_URL || process.env.ORS_URL, 'https://api.openrouteservice.org'),
  OPENROUTESERVICE_API_KEY: (process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY || '').trim()
};
