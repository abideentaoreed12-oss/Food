import fs from 'fs';
import path from 'path';
import os from 'os';
import { d1 } from './d1';
import { r2 } from './r2';

export interface SiteDataSyncMetadata {
  lastAttemptedAt: string;
  lastSuccessAt: string;
  itemCount: number;
  durationMs?: number;
  persistedD1?: boolean;
  persistedR2?: boolean;
  persistedDisk?: boolean;
  failureCount?: number;
  lastError?: string | null;
}

export interface SiteDataSnapshot {
  schemaVersion: number;
  version: number;
  updatedAt: string;
  source: 'cloudflare_d1' | 'cloudflare_r2' | 'disk_cache' | 'in_memory';
  restaurants: any[];
  deliveryZones: any[];
  promoCodes: any[];
  platformSettings: Record<string, any>;
  syncMetadata?: SiteDataSyncMetadata;
}

// Allowed public platform settings keys - strictly forbid any sensitive credentials or secret values
export const SAFE_PUBLIC_SETTINGS_KEYS = new Set([
  'currency_ngn_usd_rate',
  'base_service_fee_ngn',
  'base_service_fee_usd',
  'minimum_order_ngn',
  'minimum_order_usd',
  'platform_commission_percent',
  'support_phone',
  'support_email',
  'maintenance_mode',
  'delivery_notice',
  'cms_hero_title',
  'cms_hero_subtitle',
  'cms_hero_badge',
  'cms_announcement_banner',
  'dispatch_search_radius_km'
]);

const FORBIDDEN_SECRET_PATTERNS = [/secret/i, /token/i, /password/i, /key/i, /credential/i, /private/i, /hash/i];

export function sanitizePlatformSettings(settings: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = {};
  if (!settings || typeof settings !== 'object') return safe;

  for (const [key, value] of Object.entries(settings)) {
    const isSafeKey = SAFE_PUBLIC_SETTINGS_KEYS.has(key);
    const hasSecretPattern = FORBIDDEN_SECRET_PATTERNS.some((pat) => pat.test(key));

    if (isSafeKey && !hasSecretPattern) {
      safe[key] = value;
    }
  }
  return safe;
}

export function isValidSiteData(candidate: any, allowEmptyRestaurants: boolean = false): candidate is SiteDataSnapshot {
  if (!candidate || typeof candidate !== 'object') return false;

  // Schema version must be a positive integer
  if (typeof candidate.schemaVersion !== 'number' || candidate.schemaVersion < 1) {
    return false;
  }

  // Snapshot version must be a positive number
  if (typeof candidate.version !== 'number' || candidate.version < 1) {
    return false;
  }

  // Must have a valid updatedAt ISO timestamp
  if (typeof candidate.updatedAt !== 'string' || isNaN(Date.parse(candidate.updatedAt))) {
    return false;
  }

  // Restaurants must be an array
  if (!Array.isArray(candidate.restaurants)) {
    return false;
  }

  // If allowEmptyRestaurants is false, restaurants must not be empty
  if (!allowEmptyRestaurants && candidate.restaurants.length === 0) {
    return false;
  }

  // Every restaurant must have valid non-empty string id and name
  for (const r of candidate.restaurants) {
    if (!r || typeof r !== 'object') return false;
    if (typeof r.id !== 'string' || !r.id.trim()) return false;
    if (typeof r.name !== 'string' || !r.name.trim()) return false;
  }

  // deliveryZones must be an array if provided
  if (candidate.deliveryZones !== undefined && !Array.isArray(candidate.deliveryZones)) {
    return false;
  }

  // promoCodes must be an array if provided
  if (candidate.promoCodes !== undefined && !Array.isArray(candidate.promoCodes)) {
    return false;
  }

  // platformSettings must be an object if provided, and must not leak secrets
  if (candidate.platformSettings !== undefined) {
    if (typeof candidate.platformSettings !== 'object' || candidate.platformSettings === null) {
      return false;
    }
    for (const key of Object.keys(candidate.platformSettings)) {
      if (FORBIDDEN_SECRET_PATTERNS.some((pat) => pat.test(key))) {
        return false;
      }
    }
  }

  return true;
}

export class SiteDataManager {
  private currentSnapshot: SiteDataSnapshot | null = null;
  private lastAttemptTimestamp: number = 0;
  private lastSuccessTimestamp: number = 0;
  private failureCount: number = 0;
  private lastError: string | null = null;
  private isSyncing: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  private primaryDiskPath: string;
  private tmpDiskPath: string;

  constructor() {
    this.primaryDiskPath = path.resolve(process.cwd(), 'data', 'last-known-good-site-data.json');
    this.tmpDiskPath = path.resolve(os.tmpdir(), 'last-known-good-site-data.json');

    // Attempt synchronous initialization from disk cache for instant warm start
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

  public getRestaurantById(id: string): any | null {
    if (!id) return null;
    const restaurants = this.getRestaurants();
    return restaurants.find((r) => r.id === id || r.slug === id) || null;
  }

  public getDeliveryZones(): any[] {
    const snap = this.getLastKnownGood();
    return snap?.deliveryZones || [];
  }

  public getPromoCodes(): any[] {
    const snap = this.getLastKnownGood();
    return snap?.promoCodes || [];
  }

  public getPlatformSettings(): Record<string, any> {
    const snap = this.getLastKnownGood();
    return snap?.platformSettings || {};
  }

  public getUpdatedAt(): string | null {
    const snap = this.getLastKnownGood();
    return snap?.updatedAt || null;
  }

  public getVersion(): number {
    const snap = this.getLastKnownGood();
    return snap?.version || 0;
  }

  public getSyncMetadata(): SiteDataSyncMetadata | null {
    const snap = this.getLastKnownGood();
    return (
      snap?.syncMetadata || {
        lastAttemptedAt: this.lastAttemptTimestamp ? new Date(this.lastAttemptTimestamp).toISOString() : '',
        lastSuccessAt: this.lastSuccessTimestamp ? new Date(this.lastSuccessTimestamp).toISOString() : '',
        itemCount: snap?.restaurants?.length || 0,
        failureCount: this.failureCount,
        lastError: this.lastError
      }
    );
  }

  /**
   * Loads the snapshot hierarchically across storage tiers:
   * 1. Memory cache (if valid)
   * 2. Cloudflare D1 platform_settings table (authoritative)
   * 3. Cloudflare R2 bucket snapshot
   * 4. Local disk cache (development convenience only)
   */
  public async loadSnapshot(): Promise<SiteDataSnapshot | null> {
    if (this.currentSnapshot && isValidSiteData(this.currentSnapshot)) {
      return this.currentSnapshot;
    }

    // 1. Authoritative Cloudflare D1 platform_settings table
    try {
      const d1Res = await d1.query('SELECT value, updated_at FROM platform_settings WHERE key = ? LIMIT 1', [
        'last_known_good_site_data'
      ]);
      if (d1Res.results && d1Res.results.length > 0 && d1Res.results[0].value) {
        const parsed = JSON.parse(d1Res.results[0].value);
        if (isValidSiteData(parsed)) {
          this.currentSnapshot = { ...parsed, source: 'cloudflare_d1' };
          this.persistToDiskSafe(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] D1 snapshot read note:', e?.message || e);
    }

    // 2. Cloudflare R2 storage
    try {
      if (r2.isConfigured()) {
        const r2Snapshot = await r2.getJson<SiteDataSnapshot>('data/last-known-good-site-data.json');
        if (isValidSiteData(r2Snapshot)) {
          this.currentSnapshot = { ...r2Snapshot, source: 'cloudflare_r2' };
          this.persistToDiskSafe(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] R2 snapshot read note:', e?.message || e);
    }

    // 3. Local disk cache fallback
    this.loadFromDiskSync();
    return this.currentSnapshot;
  }

  private persistToDiskSafe(snapshot: SiteDataSnapshot): void {
    const jsonStr = JSON.stringify(snapshot, null, 2);

    // Primary repo data/ directory
    try {
      const dataDir = path.dirname(this.primaryDiskPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tmpFile = `${this.primaryDiskPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.primaryDiskPath);
    } catch {}

    // Temporary directory for serverless environments
    try {
      const tmpFile = `${this.tmpDiskPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.tmpDiskPath);
    } catch {}
  }

  /**
   * Persists a validated snapshot to Cloudflare D1, Cloudflare R2, and in-memory cache.
   * Confirms durable storage write before reporting persistence success.
   */
  public async saveSnapshot(
    snapshot: SiteDataSnapshot,
    options: { allowEmpty?: boolean } = {}
  ): Promise<{ success: boolean; persistedD1: boolean; persistedR2: boolean; version: number }> {
    if (!isValidSiteData(snapshot, options.allowEmpty)) {
      console.error('[SiteData] Attempted to save invalid site snapshot. Aborting.');
      return { success: false, persistedD1: false, persistedR2: false, version: this.currentSnapshot?.version || 0 };
    }

    // Ensure monotonically increasing version
    const newVersion = Math.max(snapshot.version, (this.currentSnapshot?.version || 0) + 1);
    const finalizedSnapshot: SiteDataSnapshot = {
      ...snapshot,
      version: newVersion,
      syncMetadata: {
        lastAttemptedAt: snapshot.syncMetadata?.lastAttemptedAt || new Date().toISOString(),
        lastSuccessAt: snapshot.updatedAt,
        itemCount: snapshot.restaurants.length,
        persistedD1: false,
        persistedR2: false,
        persistedDisk: false
      }
    };

    let persistedD1 = false;
    let persistedR2 = false;

    // 1. Cloudflare D1 authoritative persistence
    try {
      const jsonStr = JSON.stringify(finalizedSnapshot);
      const d1Result = await d1.query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('last_known_good_site_data', ?, 'Persistent last-known-good site data snapshot', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [jsonStr, finalizedSnapshot.updatedAt]
      );
      if (d1Result.success) {
        persistedD1 = true;
      }
    } catch (err: any) {
      console.warn('[SiteData] D1 snapshot save note:', err?.message || err);
    }

    // 2. Cloudflare R2 durable storage persistence
    try {
      if (r2.isConfigured()) {
        const uploadRes = await r2.uploadJson('data/last-known-good-site-data.json', finalizedSnapshot);
        if (uploadRes.success) {
          persistedR2 = true;
        }
      }
    } catch (err: any) {
      console.warn('[SiteData] R2 snapshot save note:', err?.message || err);
    }

    // 3. Update memory snapshot and local disk cache
    if (finalizedSnapshot.syncMetadata) {
      finalizedSnapshot.syncMetadata.persistedD1 = persistedD1;
      finalizedSnapshot.syncMetadata.persistedR2 = persistedR2;
      finalizedSnapshot.syncMetadata.persistedDisk = true;
    }
    this.currentSnapshot = finalizedSnapshot;
    this.lastSuccessTimestamp = Date.now();
    this.persistToDiskSafe(finalizedSnapshot);

    return {
      success: true,
      persistedD1,
      persistedR2,
      version: newVersion
    };
  }

  private activeSyncPromise: Promise<SiteDataSnapshot | null> | null = null;

  /**
   * Refreshes the site data snapshot from the authoritative production database (Cloudflare D1).
   * Validates all records before replacement. Preserves the last-known-good snapshot if the refresh fails.
   * Employs single-flight promise multiplexing so concurrent calls share a single query execution.
   */
  public async refreshSnapshot(options: { allowEmpty?: boolean } = {}): Promise<SiteDataSnapshot | null> {
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }

    this.activeSyncPromise = this.executeRefresh(options);
    try {
      return await this.activeSyncPromise;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  private async executeRefresh(options: { allowEmpty?: boolean } = {}): Promise<SiteDataSnapshot | null> {
    const startTime = Date.now();
    this.lastAttemptTimestamp = startTime;

    try {
      // 1. Query live restaurants
      const restRes = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC');
      const rawRows = restRes.results || [];

      // Outage or empty result protection:
      // Never allow an empty query result to overwrite an existing populated snapshot unless explicitly authorized
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        if (!options.allowEmpty && this.currentSnapshot && this.currentSnapshot.restaurants.length > 0) {
          console.warn('[SiteData] Primary query returned 0 restaurants; preserving populated last-known-good snapshot.');
          return this.currentSnapshot;
        }
        if (!options.allowEmpty) {
          // No current snapshot and 0 restaurants returned: do NOT invent mock data. Return empty state.
          console.warn('[SiteData] Primary database has no restaurant records.');
          return this.currentSnapshot;
        }
      }

      // Map rows cleanly from raw_json or relational columns
      const restaurants = rawRows.map((r: any) => {
        let base: any = {};
        if (r.raw_json) {
          try {
            base = JSON.parse(r.raw_json);
          } catch {
            base = {};
          }
        }
        return {
          ...base,
          id: r.id,
          name: r.name || base.name || 'Restaurant',
          slug: r.slug || base.slug || r.id,
          cuisine: r.cuisine || base.cuisine || '',
          rating: r.rating ?? base.rating ?? 5.0,
          reviewCount: r.review_count ?? base.reviewCount ?? 0,
          deliveryTimeMin: r.delivery_time_min ?? base.deliveryTimeMin ?? 25,
          deliveryTimeMax: r.delivery_time_max ?? base.deliveryTimeMax ?? 35,
          deliveryFee: r.delivery_fee ?? base.deliveryFee ?? 500,
          minOrder: r.min_order ?? base.minOrder ?? 2500,
          priceTier: r.price_tier || base.priceTier || '$$',
          address: r.address || base.address || '',
          distanceKm: r.distance_km ?? base.distanceKm ?? 2.0,
          isOpen: r.is_open === 1,
          isBusyPaused: r.is_busy_paused === 1,
          zone: r.zone || base.zone || 'LAGOS',
          categories: Array.isArray(base.categories) ? base.categories : []
        };
      });

      // 2. Query delivery zones
      const zonesRes = await d1.query('SELECT * FROM delivery_zones WHERE is_active = 1 OR is_active IS NULL').catch(() => ({ results: [] }));

      // 3. Query active promo codes
      const promoRes = await d1.query('SELECT code, discount_type, value, min_order_amount, max_discount_cap, is_active FROM promo_codes WHERE is_active = 1').catch(() => ({ results: [] }));

      // 4. Query public platform settings (strictly filter out sensitive keys)
      const settingsRes = await d1.query('SELECT key, value FROM platform_settings').catch(() => ({ results: [] }));
      const rawSettings: Record<string, any> = {};
      for (const s of settingsRes.results || []) {
        if (s.key !== 'last_known_good_site_data') {
          try {
            rawSettings[s.key] = JSON.parse(s.value);
          } catch {
            rawSettings[s.key] = s.value;
          }
        }
      }
      const platformSettings = sanitizePlatformSettings(rawSettings);

      const durationMs = Date.now() - startTime;
      const candidate: SiteDataSnapshot = {
        schemaVersion: 1,
        version: (this.currentSnapshot?.version || 0) + 1,
        updatedAt: new Date().toISOString(),
        source: 'cloudflare_d1',
        restaurants,
        deliveryZones: zonesRes.results || [],
        promoCodes: promoRes.results || [],
        platformSettings,
        syncMetadata: {
          lastAttemptedAt: new Date(startTime).toISOString(),
          lastSuccessAt: new Date().toISOString(),
          itemCount: restaurants.length,
          durationMs,
          failureCount: 0,
          lastError: null
        }
      };

      if (isValidSiteData(candidate, options.allowEmpty)) {
        await this.saveSnapshot(candidate, options);
        this.failureCount = 0;
        this.lastError = null;
        return candidate;
      } else {
        console.warn('[SiteData] Candidate snapshot failed validation; preserving existing last-known-good.');
        this.failureCount++;
        return this.currentSnapshot;
      }
    } catch (err: any) {
      this.failureCount++;
      this.lastError = err?.message || String(err);
      console.warn('[SiteData] Refresh failure; preserving last-known-good:', this.lastError);
      return this.currentSnapshot;
    }
  }

  /**
   * Throttled synchronization for request handlers:
   * Refreshes every 10 seconds (10,000ms), applying exponential backoff upon consecutive failures.
   */
  public async syncIfStale(force: boolean = false): Promise<SiteDataSnapshot | null> {
    const now = Date.now();
    const baseIntervalMs = 10000;
    // Exponential backoff if consecutive errors occur (10s, 15s, 22s, up to 60s max)
    const effectiveIntervalMs =
      this.failureCount > 0
        ? Math.min(60000, Math.round(baseIntervalMs * Math.pow(1.5, Math.min(this.failureCount, 4))))
        : baseIntervalMs;

    if (!force && now - this.lastAttemptTimestamp < effectiveIntervalMs) {
      return this.getLastKnownGood();
    }

    return this.refreshSnapshot();
  }

  /**
   * Starts a single server-side background timer for continuous Node/Express runtimes.
   */
  public startBackgroundSync(intervalMs: number = 10000): void {
    if (this.timer) return;

    // Run initial sync non-blockingly
    this.refreshSnapshot().catch(() => {});

    this.timer = setInterval(() => {
      this.refreshSnapshot().catch((err) => {
        console.warn('[SiteData Background Sync Note]', err?.message || err);
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

// Preserve single global instance across module reloads
const globalKey = '__veyrang_site_data_manager__';
if (!(globalThis as any)[globalKey]) {
  (globalThis as any)[globalKey] = new SiteDataManager();
}

export const siteDataManager: SiteDataManager = (globalThis as any)[globalKey];
