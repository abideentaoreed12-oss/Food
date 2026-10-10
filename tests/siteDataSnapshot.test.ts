import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { siteDataManager, isValidSiteData, SiteDataSnapshot } from '../lib/siteDataSnapshot';

describe('Persistent Last-Known-Good Site Data Snapshot Engine', () => {
  it('loads valid snapshot from data/last-known-good-site-data.json', () => {
    const filePath = path.resolve(process.cwd(), 'data', 'last-known-good-site-data.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(isValidSiteData(parsed)).toBe(true);
    expect(parsed.version).toBeGreaterThanOrEqual(1);
    expect(typeof parsed.updatedAt).toBe('string');
    expect(Array.isArray(parsed.restaurants)).toBe(true);
    expect(parsed.restaurants.length).toBeGreaterThan(0);

    // Verify first restaurant has valid id and name
    expect(parsed.restaurants[0].id).toBeDefined();
    expect(parsed.restaurants[0].name).toBeDefined();
  });

  it('siteDataManager returns non-empty real restaurants synchronously', () => {
    const restaurants = siteDataManager.getRestaurants();
    expect(Array.isArray(restaurants)).toBe(true);
    expect(restaurants.length).toBeGreaterThan(0);

    const snapshot = siteDataManager.getLastKnownGood();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.updatedAt).toBeDefined();
  });

  it('validates and rejects invalid or empty candidate snapshots', () => {
    expect(isValidSiteData(null)).toBe(false);
    expect(isValidSiteData({})).toBe(false);
    expect(isValidSiteData({ restaurants: [] })).toBe(false);
    expect(isValidSiteData({ restaurants: [{ notAnId: 'xyz' }] })).toBe(false);
  });

  it('preserves existing good data when broken data is supplied', async () => {
    const beforeSnapshot = siteDataManager.getLastKnownGood();
    expect(beforeSnapshot).not.toBeNull();

    // Attempt saving an invalid snapshot with empty restaurants
    const invalidCandidate = {
      version: 999,
      updatedAt: new Date().toISOString(),
      source: 'cloudflare_d1' as const,
      restaurants: []
    } as any;

    const saved = await siteDataManager.saveSnapshot(invalidCandidate);
    expect(saved).toBe(false);

    // Snapshot remains untouched
    const afterSnapshot = siteDataManager.getLastKnownGood();
    expect(afterSnapshot?.restaurants.length).toBe(beforeSnapshot?.restaurants.length);
    expect(afterSnapshot?.version).toBe(beforeSnapshot?.version);
  });

  it('syncIfStale throttles execution within 10 seconds', async () => {
    const firstCall = await siteDataManager.syncIfStale();
    expect(firstCall).not.toBeNull();

    // Call immediately after (within 10s)
    const secondCall = await siteDataManager.syncIfStale(false);
    expect(secondCall).not.toBeNull();
    // Should return identical cached snapshot reference
    expect(secondCall?.updatedAt).toBe(firstCall?.updatedAt);
  });
});
