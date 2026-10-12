import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/restaurant',
          '/courier',
          '/orders',
          '/account',
          '/favourites',
          '/payment/callback',
          '/handover/'
        ]
      }
    ],
    sitemap: 'https://www.veyrang.com/sitemap.xml',
    host: 'https://www.veyrang.com'
  };
}
