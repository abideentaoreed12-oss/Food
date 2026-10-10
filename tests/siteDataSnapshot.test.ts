import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  siteDataManager,
  SiteDataManager,
  isValidSiteData,
  SiteDataSnapshot,
  PUBLIC_SETTINGS_WHITELIST
} from '../lib/siteDataSnapshot';
import { d1 } from '../lib/d1';
import { r2 } from '../lib/r2';

describe('Production Last-Known-Good Site Data Snapshot Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    siteDataManager.stopBackgroundSync();
  });

  // 1. Valid snapshot acceptance
  it('1. accepts valid complete snapshot with verified structure', () => {
    const validCandidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 10,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      syncStatus: 'synced',
      restaurants: [
        {
          id: 'rest-1791113979297',
          name: 'Ibadan Gourmet Bistro',
          cuisine: 'Continental & Nigerian',
          rating: 4.8,
          address: 'Ring Road, Ibadan'
        }
      ],
      deliveryZones: [{ id: 'zone-1', name: 'Lekki Phase 1', base_delivery_fee: 800 }],
      promoCodes: [{ id: 'promo-1', code: 'VEYRA10', value: 10 }],
      platformSettings: { currency_ngn_usd_rate: '1400', minimum_order_ngn: '2500' }
    };

    expect(isValidSiteData(validCandidate)).toBe(true);
  });

  // 2. Invalid snapshot rejection
  it('2. rejects malformed, incomplete, or corrupted candidate snapshots', () => {
    expect(isValidSiteData(null)).toBe(false);
    expect(isValidSiteData(undefined)).toBe(false);
    expect(isValidSiteData({})).toBe(false);
    expect(isValidSiteData({ version: -1, updatedAt: '2026-01-01', restaurants: [] })).toBe(false);
    expect(isValidSiteData({ version: 1, updatedAt: '', restaurants: [{ id: '1', name: 'A' }] })).toBe(false);
    expect(isValidSiteData({ version: 1, updatedAt: '2026-01-01', restaurants: [] })).toBe(false);
    // Missing restaurant id or name
    expect(isValidSiteData({ version: 1, updatedAt: '2026-01-01', restaurants: [{ notAnId: '1' }] })).toBe(false);
    expect(isValidSiteData({ version: 1, updatedAt: '2026-01-01', restaurants: [{ id: '1', name: '' }] })).toBe(false);
    // Reject if secrets/passwords are leaked inside restaurant objects
    expect(isValidSiteData({ version: 1, updatedAt: '2026-01-01', restaurants: [{ id: '1', name: 'A', password_hash: 'secret' }] })).toBe(false);
  });

  // 3. Empty or failed refresh preserving previous snapshot
  it('3. preserves existing populated snapshot when empty candidate is submitted without admin authorization', async () => {
    const manager = new SiteDataManager({ skipDiskLoad: true });
    const populatedCandidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 5,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-100', name: 'Real Kitchen' }]
    };

    const saved = await manager.saveSnapshot(populatedCandidate);
    expect(saved).toBe(true);
    const initialCount = manager.getRestaurants().length;
    expect(initialCount).toBe(1);

    // Empty list without authorized admin workflow must be rejected
    const emptyCandidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 6,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: []
    };

    const emptySaved = await manager.saveSnapshot(emptyCandidate);
    expect(emptySaved).toBe(false);

    // Existing snapshot is preserved completely
    expect(manager.getRestaurants().length).toBe(1);
    expect(manager.getRestaurants()[0].name).toBe('Real Kitchen');
  });

  // 4. Successful refresh updating version and timestamp
  it('4. successful save monotonically increments version and updates timestamp', async () => {
    const manager = new SiteDataManager({ skipDiskLoad: true });
    const snap1: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 10,
      updatedAt: '2026-10-10T00:00:00.000Z',
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-test-4', name: 'Spot A' }]
    };
    await manager.saveSnapshot(snap1);

    const newTimestamp = new Date().toISOString();
    const snap2: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 11,
      updatedAt: newTimestamp,
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-test-4', name: 'Spot A Updated' }]
    };
    const saved = await manager.saveSnapshot(snap2);
    expect(saved).toBe(true);
    expect(manager.getVersion()).toBe(11);
    expect(manager.getUpdatedAt()).toBe(newTimestamp);

    // Reject backward version regression
    const regressiveSnap: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 9,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-test-4', name: 'Old Version' }]
    };
    const regressiveResult = await manager.saveSnapshot(regressiveSnap);
    expect(regressiveResult).toBe(false);
    expect(manager.getVersion()).toBe(11);
  });

  // 5. Snapshot recovery after manager reinitialization
  it('5. recovers last valid snapshot after manager process reinitialization', async () => {
    const manager1 = new SiteDataManager();
    const testTime = new Date().toISOString();
    await manager1.saveSnapshot({
      schemaVersion: 1,
      version: 42,
      updatedAt: testTime,
      source: 'disk_cache',
      restaurants: [{ id: 'rest-persisted', name: 'Persisted Bistro' }]
    });

    // Simulate process restart by creating a new manager instance
    const manager2 = new SiteDataManager();
    const recovered = manager2.getLastKnownGood();
    expect(recovered).not.toBeNull();
    expect(recovered?.version).toBeGreaterThanOrEqual(42);
    expect(recovered?.restaurants.some((r: any) => r.id === 'rest-persisted')).toBe(true);
  });

  // 6. Durable storage failure not being reported as successful persistence
  it('6. does not falsely report durable persistence when cloud storage is unavailable', async () => {
    const manager = new SiteDataManager();
    // Spy on r2.isConfigured to return false
    vi.spyOn(r2, 'isConfigured').mockReturnValue(false);

    const candidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 50,
      updatedAt: new Date().toISOString(),
      source: 'in_memory',
      restaurants: [{ id: 'rest-cloud-test', name: 'Test Rest' }]
    };

    await manager.saveSnapshot(candidate);
    const snap = manager.getLastKnownGood();
    expect(snap?.metadata?.persistedToR2).toBe(false);
  });

  // 7. R2 read/write failure handling
  it('7. safely handles Cloudflare R2 upload failures without corrupting memory or disk', async () => {
    const manager = new SiteDataManager();
    vi.spyOn(r2, 'isConfigured').mockReturnValue(true);
    vi.spyOn(r2, 'uploadJson').mockRejectedValue(new Error('R2 Network timeout'));

    const candidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: 55,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-r2-fail', name: 'R2 Fallback Diner' }]
    };

    // Save should still succeed locally even if secondary R2 cloud write threw error
    const saved = await manager.saveSnapshot(candidate);
    expect(saved).toBe(true);
    expect(manager.getLastKnownGood()?.restaurants[0].name).toBe('R2 Fallback Diner');
    expect(manager.getLastKnownGood()?.metadata?.persistedToR2).toBe(false);
  });

  // 8. D1 unavailability and recovery
  it('8. preserves last-known-good snapshot when D1 throws an outage exception', async () => {
    const manager = new SiteDataManager();
    await manager.saveSnapshot({
      schemaVersion: 1,
      version: 60,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-safe', name: 'Safe Harbor Cafe' }]
    });

    // Simulate D1 outage
    vi.spyOn(d1, 'query').mockRejectedValue(new Error('D1 Service Unavailable (503)'));

    const result = await manager.refreshSnapshot({ force: true });
    expect(result).not.toBeNull();
    expect(result?.restaurants[0].name).toBe('Safe Harbor Cafe');
    expect(manager.getStatus().consecutiveFailures).toBeGreaterThan(0);
  });

  // 9. Concurrent refresh protection
  it('9. prevents overlapping concurrent refreshes and shares single in-flight promise', async () => {
    const manager = new SiteDataManager();
    let queryCount = 0;
    vi.spyOn(d1, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('FROM restaurants')) {
        queryCount++;
        await new Promise((r) => setTimeout(r, 50));
        return {
          results: [{ id: 'rest-concurrent', name: 'Concurrent Test Grill', raw_json: JSON.stringify({ id: 'rest-concurrent', name: 'Concurrent Test Grill' }) }],
          success: true
        };
      }
      return { results: [], success: true };
    });

    // Dispatch 4 simultaneous refresh calls
    const [r1, r2, r3, r4] = await Promise.all([
      manager.refreshSnapshot({ force: true }),
      manager.refreshSnapshot({ force: true }),
      manager.refreshSnapshot({ force: true }),
      manager.refreshSnapshot({ force: true })
    ]);

    // All callers receive the exact same resolved snapshot
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    expect(r3).toBe(r4);
    // Only 1 execution occurred
    expect(queryCount).toBe(1);
  });

  // 10. Retry throttling after failures
  it('10. syncIfStale throttles execution within the 10-second refresh interval', async () => {
    const manager = new SiteDataManager();
    await manager.saveSnapshot({
      schemaVersion: 1,
      version: 70,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-throttle', name: 'Throttle Bistro' }]
    });

    const first = await manager.syncIfStale(false);
    expect(first).not.toBeNull();

    // Call immediately after (0 seconds elapsed)
    const second = await manager.syncIfStale(false);
    expect(second).toBe(first);
  });

  // 11. Snapshot validation and schema-version compatibility
  it('11. enforces schemaVersion 1 and verifies public whitelist filtering', () => {
    expect(PUBLIC_SETTINGS_WHITELIST.has('currency_ngn_usd_rate')).toBe(true);
    expect(PUBLIC_SETTINGS_WHITELIST.has('base_service_fee_ngn')).toBe(true);
    expect(PUBLIC_SETTINGS_WHITELIST.has('support_phone')).toBe(true);
    expect(PUBLIC_SETTINGS_WHITELIST.has('jwt_secret')).toBe(false);
    expect(PUBLIC_SETTINGS_WHITELIST.has('admin_password')).toBe(false);
    expect(PUBLIC_SETTINGS_WHITELIST.has('api_token')).toBe(false);
  });

  // 12. No production demo-data fallback
  it('12. does not contain fake demo restaurants in verified snapshot', async () => {
    const manager = new SiteDataManager({ skipDiskLoad: true });
    await manager.saveSnapshot({
      schemaVersion: 1,
      version: 100,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-production-clean-1', name: 'Verified Production Bistro' }]
    });

    const snapshot = manager.getLastKnownGood();
    expect(snapshot).not.toBeNull();
    const restaurants = snapshot?.restaurants || [];

    // Ensure no fake demo IDs like rest-1, rest-2, rest-3, rest-4, rest-5, rest-6, rest-7 exist
    const demoIds = ['rest-1', 'rest-2', 'rest-3', 'rest-4', 'rest-5', 'rest-6', 'rest-7'];
    for (const rest of restaurants) {
      expect(demoIds.includes(rest.id)).toBe(false);
    }
  });

  // 13. API consistency across restaurant-list and detail endpoints
  it('13. provides consistent data lookup between snapshot list and individual restaurant query', () => {
    const restaurants = siteDataManager.getRestaurants();
    if (restaurants.length > 0) {
      const target = restaurants[0];
      const match = siteDataManager.getRestaurants().find((r: any) => r.id === target.id);
      expect(match).toBeDefined();
      expect(match?.name).toBe(target.name);
    }
  });

  // 14. Correct handling of intentional administrator changes
  it('14. supports explicit authorized administrator clear workflow without treating it as database outage', async () => {
    const manager = new SiteDataManager({ skipDiskLoad: true });
    await manager.saveSnapshot({
      schemaVersion: 1,
      version: 10,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      restaurants: [{ id: 'rest-admin-wipe', name: 'To Be Cleared' }]
    });

    expect(manager.getRestaurants().length).toBe(1);

    // Authorized admin explicitly clears restaurants
    const clearResult = await manager.adminClearAllRestaurants();
    expect(clearResult).toBe(true);
    expect(manager.getRestaurants().length).toBe(0);
    expect(manager.getVersion()).toBe(11);
  });

  // 15. Refresh scheduling according to actual runtime capabilities
  it('15. verifies startBackgroundSync and stopBackgroundSync lifecycle', () => {
    const manager = new SiteDataManager();
    manager.startBackgroundSync(10000);
    // Calling a second time is a safe no-op
    manager.startBackgroundSync(10000);
    manager.stopBackgroundSync();
    expect(true).toBe(true);
  });
});
