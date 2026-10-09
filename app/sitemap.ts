import type { MetadataRoute } from 'next';
import { d1 } from '../lib/d1';

const SITE = 'https://www.veyrang.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ['/', '/about', '/privacy', '/terms'];
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path === '/' ? 'daily' : 'yearly',
    priority: path === '/' ? 1 : 0.4
  }));

  // Only emit detail URLs for restaurant records that exist in D1.
  // The restaurants table has no updated_at column, so don't query it here.
  try {
    const result = await d1.query('SELECT id FROM restaurants ORDER BY rating DESC LIMIT 500');
    if (result.success) {
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
