import { Router, Request, Response } from 'express';
import { d1Client } from '../db/d1Client.ts';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// Standard Minimal Public Health Check
router.get('/', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Admin-Authenticated Database Health Check Endpoint
router.get('/d1', requireAuth, requireRole(['admin', 'sub_admin']), async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();
  
  try {
    const pingStart = Date.now();
    const pingResult = await d1Client.query('SELECT 1 as live_status, CURRENT_TIMESTAMP as cf_timestamp;');
    const latencyMs = Date.now() - pingStart;

    if (!pingResult?.success || !pingResult.results || pingResult.results.length === 0) {
      throw new Error('No response returned from database query endpoint.');
    }

    const [
      usersCountRes,
      ordersCountRes,
      restaurantsCountRes,
      menuCountRes,
      transactionsCountRes,
      auditCountRes,
      zonesCountRes,
      promosCountRes
    ] = await Promise.all([
      d1Client.query('SELECT COUNT(*) as count FROM users;'),
      d1Client.query('SELECT COUNT(*) as count FROM orders;'),
      d1Client.query('SELECT COUNT(*) as count FROM restaurants;'),
      d1Client.query('SELECT COUNT(*) as count FROM menu_items;'),
      d1Client.query('SELECT COUNT(*) as count FROM transactions;'),
      d1Client.query('SELECT COUNT(*) as count FROM audit_logs;'),
      d1Client.query('SELECT COUNT(*) as count FROM delivery_zones;'),
      d1Client.query('SELECT COUNT(*) as count FROM promo_codes;')
    ]);

    const countResults = [usersCountRes, ordersCountRes, restaurantsCountRes, menuCountRes, transactionsCountRes, auditCountRes, zonesCountRes, promosCountRes];
    if (countResults.some(result => !result.success || !result.results?.[0])) {
      return res.status(503).json({
        success: false,
        status: 'degraded',
        connected: false,
        latencyMs: Date.now() - startTime,
        error: 'One or more D1 health queries failed; table counts are unavailable',
        checkedAt: new Date().toISOString()
      });
    }

    const tableCounts = {
      users: Number(usersCountRes.results[0].count),
      orders: Number(ordersCountRes.results[0].count),
      restaurants: Number(restaurantsCountRes.results[0].count),
      menuItems: Number(menuCountRes.results[0].count),
      transactions: Number(transactionsCountRes.results[0].count),
      auditLogs: Number(auditCountRes.results[0].count),
      deliveryZones: Number(zonesCountRes.results[0].count),
      promoCodes: Number(promosCountRes.results[0].count)
    };

    return res.status(200).json({
      success: true,
      status: 'healthy',
      connected: true,
      latencyMs,
      tableCounts,
      timestamps: {
        checkedAt: new Date().toISOString(),
        edgeTimestamp: pingResult.results[0]?.cf_timestamp || null
      },
      totalDurationMs: Date.now() - startTime
    });
  } catch (error: any) {
    return res.status(503).json({
      success: false,
      status: 'degraded',
      connected: false,
      latencyMs: Date.now() - startTime,
      error: 'Failed to establish connection to database',
      checkedAt: new Date().toISOString()
    });
  }
});

// Admin-Authenticated Database Ping Endpoint
router.post('/d1/ping', requireAuth, requireRole(['admin', 'sub_admin']), async (req: AuthRequest, res: Response) => {
  const start = Date.now();
  try {
    const d1Res = await d1Client.query('SELECT 1 as alive, CURRENT_TIMESTAMP as edge_time;');
    const latency = Date.now() - start;
    return res.json({
      success: true,
      latencyMs: latency,
      edgeTime: d1Res?.results?.[0]?.edge_time
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      latencyMs: Date.now() - start,
      error: err.message
    });
  }
});

export default router;
