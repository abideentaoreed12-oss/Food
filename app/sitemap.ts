import type { MetadataRoute } from 'next';
import { d1 } from '../lib/d1';
import { siteDataManager } from '../lib/siteDataSnapshot';

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

  // Emit detail URLs for open restaurant records from authoritative snapshot first
  try {
    const snapshot = siteDataManager.getLastKnownGood() || await siteDataManager.servePublicCatalogue();
    let restaurantIds: string[] = [];
    if (snapshot?.restaurants?.length) {
      restaurantIds = snapshot.restaurants.map((r: any) => String(r.id || '')).filter(Boolean);
    } else {
      const result = await d1.query('SELECT id FROM restaurants ORDER BY rating DESC LIMIT 500');
      if (result && result.success) {
        restaurantIds = (result.results || []).map((row: any) => String(row.id || '')).filter(Boolean);
      }
    }
    for (const id of restaurantIds) {
      if (!id || /[/?#]/.test(id)) continue;
      entries.push({
        url: `${SITE}/restaurants/${encodeURIComponent(id)}`,
        changeFrequency: 'weekly',
        priority: 0.7
      });
    }
  } catch {
    // Keep static sitemap routes available when data is temporarily unavailable.
  }

  return entries;
}
