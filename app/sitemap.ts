import type { MetadataRoute } from 'next';
import { d1 } from '../lib/d1';

const SITE = 'https://www.veyrang.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    '/',
    '/about',
    '/privacy',
    '/terms'
  ];
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: path === '/' ? 'daily' : 'yearly',
    priority: path === '/' ? 1 : 0.4
  }));

  // Include only restaurant pages that the application actually supports.
  // The UI is currently a client-side SPA, so do not invent /restaurants/{id}
  // SEO pages until dedicated server-rendered pages exist.
  try {
    const result = await d1.query('SELECT id, raw_json FROM restaurants ORDER BY rating DESC LIMIT 500');
    if (result.success) {
      for (const row of result.results || []) {
        const id = String(row.id || '');
        if (!id) continue;
        // Keep only existing app routes; API IDs are not assumed to be page URLs.
      }
    }
  } catch {
    // Sitemap remains available with static routes when the database is unavailable.
  }

  return entries;
}
