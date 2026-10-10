import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self' https://checkout.paystack.com https://*.paystack.com",
      "img-src 'self' data: blob: https: https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.googleapis.com https://*.gstatic.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.paystack.com https://*.googleapis.com https://*.gstatic.com",
      "worker-src 'self' blob:",
      "connect-src 'self' https: wss: https://api.paystack.co https://*.googleapis.com https://*.gstatic.com https://*.google-analytics.com",
      "frame-src 'self' https://checkout.paystack.com https://*.paystack.com https://www.google.com https://maps.google.com"
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw',
    GOOGLE_MAPS_API_KEY:
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw',
    NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL:
      process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://cdn.veyrang.com',
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_live_49b0196c7c50a9138e64d0a169ea5cced6ff14f0',
    APP_URL:
      process.env.APP_URL || 'https://www.veyrang.com',
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.veyrang.com',
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || '',
    PAYSTACK_CALLBACK_URL:
      process.env.PAYSTACK_CALLBACK_URL || 'https://www.veyrang.com/payment/callback',
    PAYSTACK_WEBHOOK_URL:
      process.env.PAYSTACK_WEBHOOK_URL || 'https://www.veyrang.com/api/webhooks/paystack',
    SMTP_HOST:
      process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT:
      process.env.SMTP_PORT || '465',
    EMAIL_SENDER_NAME:
      process.env.EMAIL_SENDER_NAME || 'Veyrang Support',
    NOMINATIM_BASE_URL:
      process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
    PHOTON_BASE_URL:
      process.env.PHOTON_BASE_URL || 'https://photon.komoot.io',
    OSRM_BASE_URL:
      process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
    VALHALLA_BASE_URL:
      process.env.VALHALLA_BASE_URL || 'https://valhalla.openstreetmap.de',
    OPENROUTESERVICE_BASE_URL:
      process.env.OPENROUTESERVICE_BASE_URL || 'https://api.openrouteservice.org',
    GRAPHHOPPER_BASE_URL:
      process.env.GRAPHHOPPER_BASE_URL || 'https://graphhopper.com/api/1',
  },
  // Only explicitly approved image origins may be fetched by the public optimizer.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev', pathname: '/**' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'veyrang.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.veyrang.com', pathname: '/**' }
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    minimumCacheTTL: 31536000, // Optimize cache for 1 year
    formats: ['image/avif', 'image/webp']
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion/react'],
    typedRoutes: true,
  },
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
