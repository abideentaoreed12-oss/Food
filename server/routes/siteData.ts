import { Router, Request, Response } from 'express';
import { siteDataManager } from '../../lib/siteDataSnapshot.ts';

const router = Router();

// Public: Serve last-known-good site data snapshot with no mock data
router.get('/public', async (_req: Request, res: Response) => {
  try {
    siteDataManager.syncIfStale().catch(() => {});
    const snapshot = siteDataManager.getLastKnownGood();

    if (!snapshot) {
      return res.status(503).json({
        success: false,
        error: 'Site data snapshot is warming up. Please retry shortly.',
        data: null
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
    return res.json({
      success: true,
      data: {
        version: snapshot.version,
        schemaVersion: snapshot.schemaVersion || 1,
        updatedAt: snapshot.updatedAt,
        source: snapshot.source,
        syncStatus: snapshot.syncStatus || 'synced',
        restaurants: snapshot.restaurants || [],
        deliveryZones: snapshot.deliveryZones || [],
        promoCodes: snapshot.promoCodes || [],
        platformSettings: snapshot.platformSettings || {},
        metadata: snapshot.metadata
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Snapshot health and verification status
router.get('/snapshot', async (_req: Request, res: Response) => {
  try {
    const status = siteDataManager.getStatus();
    const snapshot = siteDataManager.getLastKnownGood();
    return res.json({
      success: true,
      data: {
        ...status,
        snapshot: snapshot ? {
          version: snapshot.version,
          updatedAt: snapshot.updatedAt,
          source: snapshot.source,
          restaurantsCount: snapshot.restaurants?.length || 0,
          deliveryZonesCount: snapshot.deliveryZones?.length || 0,
          promoCodesCount: snapshot.promoCodes?.length || 0
        } : null
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Admin manual refresh trigger
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    const refreshed = await siteDataManager.refreshSnapshot({ force: true });
    return res.json({
      success: !!refreshed,
      message: refreshed ? 'Site snapshot refreshed successfully' : 'Failed to refresh snapshot',
      data: siteDataManager.getStatus()
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
