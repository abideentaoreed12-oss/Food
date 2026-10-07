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
router.get('/zones', async (req: Request, res: Response) => {
  try {
    const checkSeeded = await d1Client.query('SELECT value FROM platform_settings WHERE key = ? LIMIT 1', ['seeded_delivery_zones']);
    const isSeeded = checkSeeded.results && checkSeeded.results.length > 0;

    if (!isSeeded) {
      const now = new Date().toISOString();
      const initialZones = [
        ['zone-lekki', 'Lekki Phase 1', 'LEKKI', 'Lagos', 'Nigeria', 'NGN', 6.4474, 3.4723, 15, 1000, 200, 1.0, now],
        ['zone-vi', 'Victoria Island', 'VI', 'Lagos', 'Nigeria', 'NGN', 6.4281, 3.4219, 15, 1200, 200, 1.0, now],
        ['zone-ikoyi', 'Ikoyi', 'IKOYI', 'Lagos', 'Nigeria', 'NGN', 6.4549, 3.4411, 15, 1500, 250, 1.0, now],
        ['zone-ikeja', 'Ikeja', 'IKEJA', 'Lagos', 'Nigeria', 'NGN', 6.5921, 3.3422, 20, 1800, 250, 1.0, now],
        ['zone-yaba', 'Yaba District', 'YABA', 'Lagos', 'Nigeria', 'NGN', 6.5164, 3.3858, 15, 1200, 200, 1.0, now],
        ['zone-abuja', 'Abuja Core', 'ABUJA', 'Abuja', 'Nigeria', 'NGN', 9.0765, 7.3986, 25, 1500, 250, 1.0, now],
        ['zone-nyc', 'Manhattan NYC', 'NYC', 'New York', 'USA', 'USD', 40.7831, -73.9712, 10, 5, 1.5, 1.0, now]
      ];
      for (const z of initialZones) {
        try {
          await d1Client.query(
            `INSERT OR IGNORE INTO delivery_zones (
              id, name, code, city, country, currency, center_lat, center_lng, 
              base_delivery_fee, per_km_fee, surge_multiplier, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [z[0], z[1], z[2], z[3], z[4], z[5], z[6], z[7], z[9], z[10], z[11], z[12]]
          );
        } catch (e) {
          // Gracefully continue if columns are different
        }
      }
      await d1Client.query(
        `INSERT INTO platform_settings (key, value, description, category, updated_at)
         VALUES (?, ?, ?, 'general', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        ['seeded_delivery_zones', 'true', 'Seeded delivery zones default values', now]
      ).catch(() => {});
    }

    const results = await d1Client.query(
      'SELECT * FROM delivery_zones WHERE is_active = 1 ORDER BY name ASC'
    );
    return res.json({
      success: true,
      data: results.results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2b. Get Live Dynamic Promotional Codes (Protected from D1)
router.get('/promos', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const checkSeeded = await d1Client.query('SELECT value FROM platform_settings WHERE key = ? LIMIT 1', ['seeded_promo_codes']);
    const isSeeded = checkSeeded.results && checkSeeded.results.length > 0;

    if (!isSeeded) {
      const now = new Date().toISOString();
      const initialPromos = [
        ['promo-1', 'WELCOME500', 'fixed', 500, 2000, 500, 1, '2026-12-31', now],
        ['promo-2', 'LEKKI20', 'percentage', 20, 2500, 1500, 1, '2026-12-31', now],
        ['promo-3', 'FREEDROP', 'fixed', 1000, 3000, 1000, 1, '2026-12-31', now],
        ['promo-4', 'NAIRAFEAST', 'fixed', 1000, 3500, 1000, 1, '2026-12-31', now]
      ];
      for (const p of initialPromos) {
        await d1Client.query(
          'INSERT OR IGNORE INTO promo_codes (id, code, discount_type, value, min_order_amount, max_discount_cap, is_active, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          p
        ).catch(() => {});
      }
      await d1Client.query(
        `INSERT INTO platform_settings (key, value, description, category, updated_at)
         VALUES (?, ?, ?, 'general', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
        ['seeded_promo_codes', 'true', 'Seeded promo codes default values', now]
      ).catch(() => {});
    }

    const results = await d1Client.query(
      'SELECT id, code, discount_type, value, min_order_amount, max_discount_cap, is_active FROM promo_codes WHERE is_active = 1 ORDER BY created_at DESC'
    );

    return res.json({
      success: true,
      data: results.results
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Update Platform Setting (Admin Guarded)
const handleSettingUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
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
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object is required' });
    }

    const now = new Date().toISOString();
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined && val !== null) {
        await d1Client.query(
          `INSERT INTO platform_settings (key, value, description, category, updated_at)
           VALUES (?, ?, ?, 'general', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
          [key, String(val), key, now]
        );
      }
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

    await d1Client.query(
      `UPDATE delivery_zones SET
        base_delivery_fee = COALESCE(?, base_delivery_fee),
        per_km_fee = COALESCE(?, per_km_fee),
        surge_multiplier = COALESCE(?, surge_multiplier),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [base_delivery_fee ?? null, per_km_fee ?? null, surge_multiplier ?? null, is_active ?? null, id]
    );

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
