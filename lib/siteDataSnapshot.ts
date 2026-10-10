import fs from 'fs';
import path from 'path';
import os from 'os';
import { d1 } from './d1';
import { r2 } from './r2';

export interface SiteDataSnapshot {
  version: number;
  updatedAt: string;
  source: 'cloudflare_d1' | 'cloudflare_r2' | 'disk_cache' | 'in_memory';
  restaurants: any[];
  deliveryZones?: any[];
  promoCodes?: any[];
  platformSettings?: Record<string, any>;
}

export function isValidSiteData(candidate: any): candidate is SiteDataSnapshot {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!Array.isArray(candidate.restaurants) || candidate.restaurants.length === 0) return false;
  // Ensure restaurants have valid ids and names
  const validCount = candidate.restaurants.filter((r: any) => r && typeof r.id === 'string' && typeof r.name === 'string').length;
  return validCount > 0 && validCount === candidate.restaurants.length;
}

class SiteDataManager {
  private currentSnapshot: SiteDataSnapshot | null = null;
  private lastSyncTimestamp: number = 0;
  private isSyncing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  private primaryDiskPath: string;
  private tmpDiskPath: string;

  constructor() {
    this.primaryDiskPath = path.resolve(process.cwd(), 'data', 'last-known-good-site-data.json');
    this.tmpDiskPath = path.resolve(os.tmpdir(), 'last-known-good-site-data.json');

    // Attempt synchronous initialization from local disk
    this.loadFromDiskSync();
  }

  private loadFromDiskSync(): void {
    try {
      if (fs.existsSync(this.primaryDiskPath)) {
        const raw = fs.readFileSync(this.primaryDiskPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isValidSiteData(parsed)) {
          this.currentSnapshot = { ...parsed, source: 'disk_cache' };
          return;
        }
      }
    } catch {}

    try {
      if (fs.existsSync(this.tmpDiskPath)) {
        const raw = fs.readFileSync(this.tmpDiskPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isValidSiteData(parsed)) {
          this.currentSnapshot = { ...parsed, source: 'disk_cache' };
        }
      }
    } catch {}
  }

  public getLastKnownGood(): SiteDataSnapshot | null {
    if (!this.currentSnapshot) {
      this.loadFromDiskSync();
    }
    return this.currentSnapshot;
  }

  public getRestaurants(): any[] {
    const snap = this.getLastKnownGood();
    return snap?.restaurants || [];
  }

  public getUpdatedAt(): string | null {
    const snap = this.getLastKnownGood();
    return snap?.updatedAt || null;
  }

  /**
   * Loads the snapshot with cloud fallbacks:
   * 1. Memory cache
   * 2. Cloudflare D1 platform_settings table
   * 3. Local disk snapshot (data/last-known-good-site-data.json)
   * 4. Cloudflare R2 bucket snapshot
   */
  public async loadSnapshot(): Promise<SiteDataSnapshot | null> {
    if (this.currentSnapshot && isValidSiteData(this.currentSnapshot)) {
      return this.currentSnapshot;
    }

    // 1. Try Cloudflare D1 platform_settings table
    try {
      const d1Res = await d1.query('SELECT value FROM platform_settings WHERE key = ? LIMIT 1', ['last_known_good_site_data']);
      if (d1Res.results && d1Res.results.length > 0 && d1Res.results[0].value) {
        const parsed = JSON.parse(d1Res.results[0].value);
        if (isValidSiteData(parsed)) {
          this.currentSnapshot = { ...parsed, source: 'cloudflare_d1' };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] D1 snapshot read warning:', e?.message || e);
    }

    // 2. Try disk
    this.loadFromDiskSync();
    if (this.currentSnapshot) {
      return this.currentSnapshot;
    }

    // 3. Try Cloudflare R2
    try {
      if (r2.isConfigured()) {
        const r2Snapshot = await r2.getJson<SiteDataSnapshot>('data/last-known-good-site-data.json');
        if (isValidSiteData(r2Snapshot)) {
          this.currentSnapshot = { ...r2Snapshot, source: 'cloudflare_r2' };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] R2 snapshot read warning:', e?.message || e);
    }

    return this.currentSnapshot;
  }

  private persistToDisk(snapshot: SiteDataSnapshot): void {
    const jsonStr = JSON.stringify(snapshot, null, 2);

    // Save to primary repo data/ directory
    try {
      const dataDir = path.dirname(this.primaryDiskPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tmpFile = `${this.primaryDiskPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.primaryDiskPath);
    } catch {}

    // Save to /tmp for serverless runtime durability
    try {
      const tmpFile = `${this.tmpDiskPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.tmpDiskPath);
    } catch {}
  }

  /**
   * Saves a validated snapshot to memory, disk, Cloudflare D1, and Cloudflare R2.
   */
  public async saveSnapshot(snapshot: SiteDataSnapshot): Promise<boolean> {
    if (!isValidSiteData(snapshot)) {
      console.error('[SiteData] Attempted to save invalid or empty site snapshot. Aborting.');
      return false;
    }

    this.currentSnapshot = snapshot;
    this.lastSyncTimestamp = Date.now();

    // 1. Persist to disk
    this.persistToDisk(snapshot);

    // 2. Persist asynchronously to Cloudflare D1
    const jsonStr = JSON.stringify(snapshot);
    d1.query(
      `INSERT INTO platform_settings (key, value, description, updated_at)
       VALUES ('last_known_good_site_data', ?, 'Persistent last-known-good site data snapshot', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [jsonStr, snapshot.updatedAt]
    ).catch((err: any) => {
      console.warn('[SiteData] D1 snapshot save note:', err?.message || err);
    });

    // 3. Persist asynchronously to Cloudflare R2
    if (r2.isConfigured()) {
      r2.uploadJson('data/last-known-good-site-data.json', snapshot).catch((err: any) => {
        console.warn('[SiteData] R2 snapshot save note:', err?.message || err);
      });
    }

    return true;
  }

  /**
   * Refreshes the site data snapshot from the primary database (Cloudflare D1).
   * Validates fresh data before updating. If retrieval fails, preserves the last known good.
   */
  public async refreshSnapshot(): Promise<SiteDataSnapshot | null> {
    if (this.isSyncing) {
      return this.currentSnapshot;
    }

    this.isSyncing = true;
    try {
      const restRes = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC');
      const rawRows = restRes.results || [];

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        console.warn('[SiteData] Primary query returned 0 restaurants. Retaining last-known-good snapshot.');
        return this.currentSnapshot;
      }

      const restaurants = rawRows.map((r: any) => {
        if (r.raw_json) {
          try {
            const parsed = JSON.parse(r.raw_json);
            return {
              ...parsed,
              id: r.id,
              name: r.name || parsed.name,
              cuisine: r.cuisine || parsed.cuisine,
              rating: r.rating ?? parsed.rating,
              reviewCount: r.review_count ?? parsed.reviewCount,
              deliveryTimeMin: r.delivery_time_min ?? parsed.deliveryTimeMin,
              deliveryTimeMax: r.delivery_time_max ?? parsed.deliveryTimeMax,
              deliveryFee: r.delivery_fee ?? parsed.deliveryFee,
              isOpen: r.is_open === 1,
              isBusyPaused: r.is_busy_paused === 1
            };
          } catch {}
        }
        return {
          ...r,
          isOpen: r.is_open === 1,
          isBusyPaused: r.is_busy_paused === 1
        };
      });

      const zonesRes = await d1.query('SELECT * FROM delivery_zones').catch(() => ({ results: [] }));
      const promoRes = await d1.query('SELECT * FROM promo_codes WHERE is_active = 1').catch(() => ({ results: [] }));
      const settingsRes = await d1.query('SELECT * FROM platform_settings').catch(() => ({ results: [] }));

      const settings: Record<string, any> = {};
      for (const s of (settingsRes.results || [])) {
        if (s.key !== 'last_known_good_site_data') {
          settings[s.key] = s.value;
        }
      }

      const candidate: SiteDataSnapshot = {
        version: (this.currentSnapshot?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        source: 'cloudflare_d1',
        restaurants,
        deliveryZones: zonesRes.results || [],
        promoCodes: promoRes.results || [],
        platformSettings: settings
      };

      if (isValidSiteData(candidate)) {
        await this.saveSnapshot(candidate);
        return candidate;
      } else {
        console.warn('[SiteData] Candidate snapshot failed validation. Preserving existing last-known-good.');
        return this.currentSnapshot;
      }
    } catch (err: any) {
      console.warn('[SiteData] Failed to refresh snapshot from primary source:', err?.message || err, 'Serving last-known-good.');
      return this.currentSnapshot;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Throttled sync: Runs at most once every 10 seconds (10,000 ms).
   * Safe to call from serverless request handlers without introducing latency.
   */
  public async syncIfStale(force: boolean = false): Promise<SiteDataSnapshot | null> {
    const now = Date.now();
    const intervalMs = 10000; // 10 seconds refresh interval

    if (!force && (now - this.lastSyncTimestamp < intervalMs)) {
      return this.getLastKnownGood();
    }

    // Trigger refresh in background if stale
    return this.refreshSnapshot();
  }

  /**
   * Starts a persistent server-side background timer for long-running Node/Express processes.
   */
  public startBackgroundSync(intervalMs: number = 10000): void {
    if (this.timer) return;

    // Run initial sync
    this.refreshSnapshot().catch(() => {});

    this.timer = setInterval(() => {
      this.refreshSnapshot().catch((err) => {
        console.warn('[SiteData Background Sync Interval Warning]', err?.message || err);
      });
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  public stopBackgroundSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const siteDataManager = new SiteDataManager();
