import { Router, Request, Response } from 'express';
import { d1Client } from '../db/d1Client.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { asyncHandler } from '../middleware/validate.ts';
import { cachedQuery, CacheKeys, cacheInvalidate } from '../../lib/queryCache.ts';

const router = Router();

/** GET /api/settings — public platform settings (10s server cache) */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const results = await cachedQuery(CacheKeys.settings(), async () => {
    return d1Client.query(
      `SELECT key, value FROM platform_settings ORDER BY key`
    );
  });

  const settings: Record<string, string> = {};
  for (const row of results || []) {
    if (row && row.key) settings[row.key] = String(row.value ?? '');
  }

  res.json({ success: true, settings, data: { settings } });
}));

/** GET /api/settings/zones — delivery zones (10s server cache) */
router.get('/zones', asyncHandler(async (_req: Request, res: Response) => {
  const results = await cachedQuery(CacheKeys.zones(), async () => {
    return d1Client.query(
      `SELECT id, name, code, polygon_json, base_fee_ngn, base_fee_usd, is_active, sort_order
       FROM delivery_zones
       WHERE is_active = 1
       ORDER BY sort_order ASC, name ASC`
    );
  });

  const zones = (results || []).map((z: any) => ({
    id: z.id,
    name: z.name,
    code: z.code,
    polygon: (() => {
      try { return JSON.parse(z.polygon_json || '[]'); } catch { return []; }
    })(),
    baseFeeNgn: Number(z.base_fee_ngn || 0),
    baseFeeUsd: Number(z.base_fee_usd || 0),
    isActive: Boolean(z.is_active),
    sortOrder: Number(z.sort_order || 0),
  }));

  res.json({ success: true, zones, data: zones });
}));

/** PUT /api/settings — admin update (invalidates cache) */
router.put('/', requireAuth, requireRole('admin', 'sub_admin'), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body || {};
  const entries = Object.entries(body).filter(([k]) => typeof k === 'string' && k.length > 0);

  for (const [key, value] of entries) {
    await d1Client.execute(
      `INSERT INTO platform_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, String(value ?? '')]
    );
  }

  cacheInvalidate(CacheKeys.settings());
  cacheInvalidate('settings');

  res.json({ success: true, message: 'Settings updated' });
}));

export default router;
