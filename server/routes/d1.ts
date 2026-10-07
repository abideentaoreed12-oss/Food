import { Router, Request, Response } from 'express';
import { d1Client } from '../db/d1Client.ts';
import { loadDatabase } from '../db/index.ts';
import { CONFIG } from '../config.ts';

import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// Protect all D1 database management routes with admin authentication
router.use(requireAuth, requireRole(['admin', 'sub_admin']));

// Check Live Cloudflare D1 Connection Status
router.get('/status', async (_req: AuthRequest, res: Response) => {
  const result = await d1Client.testConnection();

  return res.json({
    success: result.connected,
    cloudflare: {
      accountId: CONFIG.CLOUDFLARE_ACCOUNT_ID,
      databaseId: CONFIG.CLOUDFLARE_DATABASE_ID,
      databaseName: CONFIG.CLOUDFLARE_DATABASE_NAME || 'veyrang_production',
      zoneId: CONFIG.CLOUDFLARE_ZONE_ID
    },
    connected: result.connected,
    details: result.details || null,
    error: result.error || null,
    note: result.connected
      ? 'Live Cloudflare D1 database is active and responding.'
      : 'Cloudflare D1 rejected connection. If error mentions location/IP (Code 9109), edit the API token in Cloudflare Dashboard and remove IP restrictions.'
  });
});

// Initialize Tables on Live Cloudflare D1
router.post('/init', async (_req: Request, res: Response) => {
  try {
    await d1Client.initializeTables();
    return res.json({
      success: true,
      message: 'Cloudflare D1 tables initialized successfully'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Sync current data to Cloudflare D1
router.post('/sync', async (_req: Request, res: Response) => {
  try {
    await d1Client.initializeTables();
    const db = loadDatabase();

    let usersSynced = 0;
    for (const u of db.users) {
      await d1Client.query(
        `INSERT INTO users (id, email, password_hash, name, role, phone, address, restaurant_id, wallet_balance_usd, wallet_balance_ngn, saved_addresses, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash,
           name = excluded.name,
           role = excluded.role,
           wallet_balance_usd = excluded.wallet_balance_usd,
           wallet_balance_ngn = excluded.wallet_balance_ngn,
           updated_at = excluded.updated_at;`,
        [
          u.id,
          u.email,
          u.passwordHash,
          u.name,
          u.role,
          u.phone || null,
          u.address || null,
          u.restaurantId || null,
          u.walletBalanceUSD || 0,
          u.walletBalanceNGN || 0,
          JSON.stringify(u.savedAddresses || []),
          u.createdAt,
          u.updatedAt
        ]
      );
      usersSynced++;
    }

    return res.json({
      success: true,
      message: `Successfully synchronized ${usersSynced} users to Cloudflare D1!`,
      usersSynced
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

export default router;
