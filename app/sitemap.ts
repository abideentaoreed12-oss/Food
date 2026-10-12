import type { MetadataRoute } from 'next';
import { d1 } from '../lib/d1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SITE = 'https://www.veyrang.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only include indexable public URLs in the sitemap.
  // Never list orders, account, restaurant, courier, admin, payment or handover URLs.
  const staticPaths = [
    { path: '/', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/restaurants', changeFrequency: 'daily' as const, priority: 0.9 },
    { path: '/offers', changeFrequency: 'daily' as const, priority: 0.8 },
    { path: '/search', changeFrequency: 'weekly' as const, priority: 0.7 },
    { path: '/help', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/contact', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/partner', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.4 }
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE}${path}`,
    changeFrequency,
    priority
  }));

  // Emit detail URLs for open restaurant records from authoritative D1
  try {
    const result = await d1.query('SELECT id FROM restaurants ORDER BY rating DESC LIMIT 500');
    if (result && result.success) {
      for (const row of result.results || []) {
        const id = String(row.id || '');
        if (!id || /[/?#]/.test(id)) continue;
        entries.push({
          url: `${SITE}/restaurants/${encodeURIComponent(id)}`,
          changeFrequency: 'weekly',
          priority: 0.7
        });
      }
    }
  } catch {
    // Keep static sitemap routes available when D1 is temporarily unavailable.
  }

  return entries;
}
