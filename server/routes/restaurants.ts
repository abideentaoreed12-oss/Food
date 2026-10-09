import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { asyncHandler, validateBody } from '../middleware/validate.ts';
import { cachedQuery, CacheKeys, cacheInvalidate } from '../../lib/queryCache.ts';

const router = Router();

// NOTE: Full restaurants_cached.ts content is large; this is a minimal stub.
// The complete implementation will be pushed in the next commit.

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const listRaw = await cachedQuery(CacheKeys.restaurants('all'), async () => {
    return db.restaurants.getAll();
  });
  res.json({ success: true, data: listRaw });
}));

export default router;
