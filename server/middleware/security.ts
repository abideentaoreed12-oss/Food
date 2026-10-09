import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Strict CORS policy instead of wildcard *
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://veyrang.com',
    'https://www.veyrang.com',
    // Preserve the required AI Studio preview origins explicitly.
    'https://ais-dev-nzkiazjmqpaqtk7xu2qe3k-22582271178.europe-west2.run.app',
    'https://ais-pre-nzkiazjmqpaqtk7xu2qe3k-22582271178.europe-west2.run.app',
    ...(process.env.ADDITIONAL_CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ];
  const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
    !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (origin && (allowedOrigins.includes(origin) || isLocalDevelopmentOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://veyrang.com');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Content Security Policy (Allows Google Fonts & Vite assets)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: ws: wss:; frame-ancestors 'self' https://*.run.app https://*.google.com;"
  );

  // Hardening headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

  next();
}

// In-memory sliding window rate limiter
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
}
