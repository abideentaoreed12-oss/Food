import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  siteDataManager,
  isValidSiteData,
  SiteDataSnapshot,
  sanitizePlatformSettings,
  SAFE_PUBLIC_SETTINGS_KEYS,
  SiteDataManager
} from '../lib/siteDataSnapshot';
import { d1 } from '../lib/d1';
import { r2 } from '../lib/r2';

describe('Production Site Data Snapshot Engine & Resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Valid snapshot acceptance
  it('1. accepts a completely valid candidate snapshot', () => {
    const validCandidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 2,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [
        { id: 'rest-101', name: 'Verified Kitchen' },
        { id: 'rest-102', name: 'Lagoon Grill' }
      ],
      deliveryZones: [{ id: 'zone-1', name: 'Lekki' }],
      promoCodes: [{ code: 'WELCOME10', discount_type: 'percent', value: 10 }],
      platformSettings: { currency_ngn_usd_rate: 1500, minimum_order_ngn: 2500 }
    };
    expect(isValidSiteData(validCandidate)).toBe(true);
  });

  // 2. Invalid snapshot rejection
  it('2. rejects malformed, incomplete, or corrupted candidate snapshots', () => {
    expect(isValidSiteData(null)).toBe(false);
    expect(isValidSiteData(undefined)).toBe(false);
    expect(isValidSiteData({})).toBe(false);
    expect(isValidSiteData({ schemaVersion: 0, version: 1, updatedAt: new Date().toISOString(), restaurants: [] })).toBe(false);
    expect(isValidSiteData({ schemaVersion: 1, version: 1, updatedAt: 'not-a-date', restaurants: [] })).toBe(false);
    expect(isValidSiteData({ schemaVersion: 1, version: 1, updatedAt: new Date().toISOString(), restaurants: 'not-an-array' })).toBe(false);
    // Invalid restaurant objects (missing name or id)
    expect(isValidSiteData({
      schemaVersion: 1,
      version: 1,
      updatedAt: new Date().toISOString(),
      restaurants: [{ id: 'rest-1' }] // missing name
    })).toBe(false);
  });

  // 3. Empty or failed refresh preserving the previous snapshot
  it('3. preserves existing good snapshot when a refresh query returns 0 restaurants or fails', async () => {
    // Seed an initial valid snapshot
    const initialGood: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 10,
      updatedAt: new Date(Date.now() - 100000).toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-real-1', name: 'Real Nigerian Delights' }],
      deliveryZones: [],
      promoCodes: [],
      platformSettings: {}
    };
    await siteDataManager.saveSnapshot(initialGood);
    const beforeSnapshot = siteDataManager.getLastKnownGood();
    expect(beforeSnapshot?.restaurants.length).toBe(1);

    // Mock D1 returning empty results (e.g. transient query issue)
    vi.spyOn(d1, 'query').mockResolvedValueOnce({
      results: [],
      success: true
    } as any);

    // Refresh should preserve existing populated snapshot
    const result = await siteDataManager.refreshSnapshot({ allowEmpty: false });
    expect(result).not.toBeNull();
    expect(result?.restaurants.length).toBe(1);
    expect(result?.restaurants[0].id).toBe('rest-real-1');
  });

  // 4. Successful refresh updating version and timestamp
  it('4. increments snapshot version and records fresh updatedAt timestamp on successful refresh', async () => {
    const prevVersion = siteDataManager.getVersion();

    vi.spyOn(d1, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM restaurants')) {
        return {
          success: true,
          results: [
            { id: 'rest-fresh-1', name: 'Freshly Synced Diner', rating: 4.9, is_open: 1 }
          ]
        } as any;
      }
      return { success: true, results: [] } as any;
    });

    const refreshed = await siteDataManager.refreshSnapshot();
    expect(refreshed).not.toBeNull();
    expect(refreshed?.version).toBeGreaterThan(prevVersion);
    expect(Date.parse(refreshed!.updatedAt)).toBeGreaterThan(0);
    expect(refreshed?.restaurants[0].name).toBe('Freshly Synced Diner');
  });

  // 5. Snapshot recovery after manager reinitialization
  it('5. recovers snapshot from disk or cloud when a new SiteDataManager instance initializes', () => {
    const newManager = new SiteDataManager();
    const snap = newManager.getLastKnownGood();
    expect(snap).not.toBeNull();
    expect(Array.isArray(snap?.restaurants)).toBe(true);
  });

  // 6. Durable storage failure reporting
  it('6. correctly distinguishes confirmed cloud persistence from unconfigured/failed storage', async () => {
    // Mock R2 unconfigured and D1 failing
    vi.spyOn(r2, 'isConfigured').mockReturnValue(false);
    vi.spyOn(d1, 'query').mockRejectedValue(new Error('D1 Network Timeout'));

    const candidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 99,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-persist-test', name: 'Durable Test Kitchen' }],
      deliveryZones: [],
      promoCodes: [],
      platformSettings: {}
    };

    const saveResult = await siteDataManager.saveSnapshot(candidate);
    expect(saveResult.success).toBe(true);
    // D1 failed and R2 was unconfigured, so neither cloud persistence flag should be true
    expect(saveResult.persistedD1).toBe(false);
    expect(saveResult.persistedR2).toBe(false);
  });

  // 7. R2 read/write failure handling
  it('7. handles R2 read and write failures gracefully without crashing', async () => {
    vi.spyOn(r2, 'isConfigured').mockReturnValue(true);
    vi.spyOn(r2, 'uploadJson').mockRejectedValue(new Error('R2 Forbidden Bucket Policy'));
    vi.spyOn(r2, 'getJson').mockRejectedValue(new Error('R2 Connection Refused'));

    // Loading should not throw
    const loaded = await siteDataManager.loadSnapshot();
    expect(loaded).toBeDefined();
  });

  // 8. D1 unavailability and recovery
  it('8. preserves service continuity when D1 is unavailable and recovers upon D1 reconnect', async () => {
    // D1 down: throws network error
    vi.spyOn(d1, 'query').mockRejectedValueOnce(new Error('D1 503 Service Unavailable'));
    const fallbackSnap = await siteDataManager.refreshSnapshot();
    expect(fallbackSnap).not.toBeNull();

    // D1 back online: returns fresh data
    vi.spyOn(d1, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM restaurants')) {
        return {
          success: true,
          results: [{ id: 'rest-reconnected', name: 'Reconnected Bistro' }]
        } as any;
      }
      return { success: true, results: [] } as any;
    });

    const reconnectedSnap = await siteDataManager.refreshSnapshot();
    expect(reconnectedSnap?.restaurants[0].id).toBe('rest-reconnected');
  });

  // 9. Concurrent refresh protection (mutex/single-flight)
  it('9. prevents concurrent refreshes from executing overlapping queries', async () => {
    let callCount = 0;
    vi.spyOn(d1, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM restaurants')) {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          success: true,
          results: [{ id: 'rest-mutex', name: 'Mutex Kitchen' }]
        } as any;
      }
      return { success: true, results: [] } as any;
    });

    // Fire 3 simultaneous refreshes
    const [p1, p2, p3] = await Promise.all([
      siteDataManager.refreshSnapshot(),
      siteDataManager.refreshSnapshot(),
      siteDataManager.refreshSnapshot()
    ]);

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    // Mutex should ensure D1 restaurants query is only executed once for overlapping requests
    expect(callCount).toBe(1);
  });

  // 10. Retry throttling and backoff after failures
  it('10. throttles sync calls within the 10-second window', async () => {
    const first = await siteDataManager.syncIfStale(false);
    expect(first).not.toBeNull();

    const d1Spy = vi.spyOn(d1, 'query');
    // Second call immediately afterwards should return cached snapshot without calling D1
    const second = await siteDataManager.syncIfStale(false);
    expect(second).toBe(first);
    expect(d1Spy).not.toHaveBeenCalled();
  });

  // 11. Schema version and security check
  it('11. strictly strips private secrets and tokens from public snapshot platformSettings', () => {
    const dirtySettings = {
      currency_ngn_usd_rate: 1450,
      base_service_fee_ngn: 600,
      support_phone: '+234 800 000 0000',
      JWT_SECRET: 'super-secret-token',
      PAYSTACK_SECRET_KEY: 'sk_live_12345',
      CLOUDFLARE_API_TOKEN: 'token_123',
      ADMIN_PASSWORD: 'Password123!',
      database_password_hash: '$2b$10$xyz'
    };

    const sanitized = sanitizePlatformSettings(dirtySettings);
    expect(sanitized.currency_ngn_usd_rate).toBe(1450);
    expect(sanitized.base_service_fee_ngn).toBe(600);
    expect(sanitized.support_phone).toBe('+234 800 000 0000');
    expect(sanitized.JWT_SECRET).toBeUndefined();
    expect(sanitized.PAYSTACK_SECRET_KEY).toBeUndefined();
    expect(sanitized.CLOUDFLARE_API_TOKEN).toBeUndefined();
    expect(sanitized.ADMIN_PASSWORD).toBeUndefined();
    expect(sanitized.database_password_hash).toBeUndefined();
  });

  // 12. Never start with fake or mock data
  it('12. rejects candidate containing secret keys during snapshot validation', () => {
    const leakedCandidate: any = {
      schemaVersion: 1,
      version: 1,
      updatedAt: new Date().toISOString(),
      restaurants: [{ id: 'rest-1', name: 'Safe Grill' }],
      platformSettings: {
        ADMIN_PASSWORD: 'leak'
      }
    };
    expect(isValidSiteData(leakedCandidate)).toBe(false);
  });

  // 13. API consistency for single restaurant lookup
  it('13. provides synchronous getRestaurantById lookup matching list items', () => {
    const all = siteDataManager.getRestaurants();
    if (all.length > 0) {
      const first = all[0];
      const byId = siteDataManager.getRestaurantById(first.id);
      expect(byId).not.toBeNull();
      expect(byId?.id).toBe(first.id);
      expect(byId?.name).toBe(first.name);
    }
  });

  // 14. Intentional admin wipe support
  it('14. supports explicit authorized administrator wipe with allowEmpty flag', async () => {
    const emptyCandidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 50,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [],
      deliveryZones: [],
      promoCodes: [],
      platformSettings: {}
    };

    // Standard validation rejects empty restaurants
    expect(isValidSiteData(emptyCandidate, false)).toBe(false);

    // Explicit administrator workflow allows authorized empty catalog
    expect(isValidSiteData(emptyCandidate, true)).toBe(true);
  });

  // 15. Background sync start and stop
  it('15. correctly starts and stops continuous background interval sync', () => {
    siteDataManager.startBackgroundSync(10000);
    // Double call should be idempotent
    siteDataManager.startBackgroundSync(10000);
    siteDataManager.stopBackgroundSync();
  });
});
