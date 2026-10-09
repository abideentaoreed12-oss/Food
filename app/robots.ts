import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/payment/callback'] }
    ],
    sitemap: 'https://www.veyrang.com/sitemap.xml',
    host: 'https://www.veyrang.com'
  };
}
