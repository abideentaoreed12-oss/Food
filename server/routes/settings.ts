import { Router, Request, Response } from 'express';
import { d1Client } from '../db/d1Client.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';
import { db } from '../db/index.ts';

const router = Router();

// 1. Get Live Dynamic Platform Settings (Public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const results = await d1Client.query(
      'SELECT key, value, description, category, updated_at FROM platform_settings'
    );
    const SENSITIVE_SETTING_KEYS = [
      'platform_commission_percent',
      'driver_payout_percent',
      'stripe_secret_key',
      'paystack_secret_key',
      'flutterwave_secret_key',
      'admin_payout_ratio',
      'resend_api_key',
      'mail_key'
    ];

    const settingsMap: Record<string, string> = {};
    const safeRows: any[] = [];

    for (const row of results.results) {
      const keyLower = String(row.key).toLowerCase();
      const isSensitive = SENSITIVE_SETTING_KEYS.includes(keyLower) ||
                          keyLower.includes('secret') ||
                          keyLower.includes('private') ||
                          keyLower.includes('payout_percent') ||
                          keyLower.includes('api_key');

      if (!isSensitive) {
        settingsMap[row.key] = row.value;
        safeRows.push(row);
      }
    }

    return res.json({
      success: true,
      data: {
        settings: settingsMap,
        raw: safeRows
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Live Dynamic Delivery Zones (Public)
router.get('/zones', async (_req: Request, res: Response) => {
  try {
    const results = await d1Client.query(
      'SELECT * FROM delivery_zones WHERE is_active = 1 ORDER BY name ASC'
    );
    return res.json({ success: true, data: results.results });
  } catch (error: any) {
    return res.status(503).json({ success: false, error: 'Delivery zone service is unavailable' });
  }
});

// 2b. Read configured promotional codes; never seed invented codes on a read request.
router.get('/promos', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const results = await d1Client.query(
      'SELECT id, code, discount_type, value, min_order_amount, max_discount_cap, is_active FROM promo_codes WHERE is_active = 1 ORDER BY created_at DESC'
    );
    return res.json({ success: true, data: results.results });
  } catch (_error: any) {
    return res.status(503).json({ success: false, error: 'Promo service is unavailable' });
  }
});

// 3. Update Platform Setting (Admin Guarded)
const handleSettingUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    if (typeof key !== 'string' || !key.trim() || value === undefined || value === null) {
      return res.status(400).json({ success: false, error: 'Key and value are required' });
    }

    await d1Client.query(
      `INSERT INTO platform_settings (key, value, description, category, updated_at)
       VALUES (?, ?, ?, 'general', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
      [key, String(value), key, new Date().toISOString()]
    );

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'PLATFORM_SETTING_UPDATED',
      resource: 'PLATFORM_SETTINGS',
      resourceId: key,
      details: { key, newValue: value },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Setting ${key} updated successfully`,
      data: { key, value }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const handleBulkSettingsUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).length === 0) {
      return res.status(400).json({ success: false, error: 'Settings object is required' });
    }

    const now = new Date().toISOString();
    for (const [key, val] of Object.entries(settings)) {
      if (typeof key !== 'string' || !key.trim() || val === undefined || val === null) continue;
      await d1Client.query(
          `INSERT INTO platform_settings (key, value, description, category, updated_at)
           VALUES (?, ?, ?, 'general', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
          [key, String(val), key, now]
        );
    }

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'PLATFORM_SETTINGS_BULK_UPDATED',
      resource: 'PLATFORM_SETTINGS',
      details: { keys: Object.keys(settings) },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: 'All settings updated successfully in Cloudflare D1',
      data: settings
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.put('/update', requireAuth, requireRole(['admin', 'sub_admin']), handleSettingUpdate);
router.post('/update', requireAuth, requireRole(['admin', 'sub_admin']), handleSettingUpdate);
router.post('/bulk', requireAuth, requireRole(['admin', 'sub_admin']), handleBulkSettingsUpdate);
router.put('/bulk', requireAuth, requireRole(['admin', 'sub_admin']), handleBulkSettingsUpdate);

// 4. Update Delivery Zone Surge or Base Fee (Admin Guarded)
const handleZoneUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { base_delivery_fee, per_km_fee, surge_multiplier, is_active } = req.body;
    if (!id || (base_delivery_fee === undefined && per_km_fee === undefined && surge_multiplier === undefined && is_active === undefined)) {
      return res.status(400).json({ success: false, error: 'Zone ID and at least one field to update are required' });
    }
    for (const [name, value] of Object.entries({ base_delivery_fee, per_km_fee, surge_multiplier })) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        return res.status(400).json({ success: false, error: name + ' must be a non-negative number' });
      }
    }
    if (is_active !== undefined && ![true, false, 0, 1].includes(is_active)) {
      return res.status(400).json({ success: false, error: 'is_active must be a boolean or 0/1' });
    }

    const zoneUpdate = await d1Client.query(
      `UPDATE delivery_zones SET
        base_delivery_fee = COALESCE(?, base_delivery_fee),
        per_km_fee = COALESCE(?, per_km_fee),
        surge_multiplier = COALESCE(?, surge_multiplier),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [base_delivery_fee ?? null, per_km_fee ?? null, surge_multiplier ?? null, is_active === undefined ? null : (is_active === true || is_active === 1 ? 1 : 0), id]
    );
    if (zoneUpdate.meta?.rows_written === 0) return res.status(404).json({ success: false, error: 'Delivery zone not found or no values changed' });

    await db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'DELIVERY_ZONE_UPDATED',
      resource: 'DELIVERY_ZONES',
      resourceId: id,
      details: { base_delivery_fee, per_km_fee, surge_multiplier, is_active },
      ip: req.ip
    });

    return res.json({
      success: true,
      message: `Delivery zone ${id} updated successfully`
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.put('/zones/:id', requireAuth, requireRole(['admin', 'sub_admin']), handleZoneUpdate);
router.post('/zones/:id', requireAuth, requireRole(['admin', 'sub_admin']), handleZoneUpdate);
router.patch('/zones/:id', requireAuth, requireRole(['admin', 'sub_admin']), handleZoneUpdate);

export default router;
