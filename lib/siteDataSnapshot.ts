import fs from 'fs';
import path from 'path';
import os from 'os';
import { d1 } from './d1';
import { r2 } from './r2';

export interface SiteDataSnapshot {
  schemaVersion: number;
  version: number;
  updatedAt: string;
  lastAttemptedAt?: string;
  source: 'cloudflare_d1' | 'cloudflare_r2' | 'disk_cache' | 'in_memory' | 'database_primary';
  syncStatus?: 'synced' | 'fallback' | 'stale';
  restaurants: any[];
  deliveryZones?: any[];
  promoCodes?: any[];
  platformSettings?: Record<string, any>;
  metadata?: {
    restaurantCount: number;
    deliveryZoneCount: number;
    promoCodeCount: number;
    persistedToD1: boolean;
    persistedToR2: boolean;
    lastSuccessfulSync?: string;
    consecutiveFailures?: number;
    lastError?: string;
  };
}

// Legacy demo coupons were previously shipped in a checked-in snapshot. Never expose them as live offers.
const LEGACY_DEMO_PROMO_CODES = new Set(['FIRST50', 'WELCOME20', 'FREEDEL']);

function sanitizePromoCodes(promos: any[] | undefined): any[] {
  return (promos || []).filter((promo) => {
    const code = String(promo?.code || '').trim().toUpperCase();
    return code && !LEGACY_DEMO_PROMO_CODES.has(code);
  });
}

export const PUBLIC_SETTINGS_WHITELIST = new Set([
  'currency_ngn_usd_rate',
  'base_service_fee_ngn',
  'base_service_fee_usd',
  'minimum_order_ngn',
  'minimum_order_usd',
  'support_phone',
  'support_email',
  'maintenance_mode',
  'delivery_notice',
  'cms_hero_title',
  'cms_hero_subtitle',
  'cms_hero_badge',
  'cms_announcement_banner',
  'platform_commission_percent'
]);

export function isValidSiteData(
  candidate: any,
  options?: { allowEmpty?: boolean }
): candidate is SiteDataSnapshot {
  if (!candidate || typeof candidate !== 'object') return false;
  if (typeof candidate.version !== 'number' || !Number.isFinite(candidate.version) || candidate.version < 1) return false;
  if (typeof candidate.updatedAt !== 'string' || !candidate.updatedAt.trim()) return false;
  if (!Array.isArray(candidate.restaurants)) return false;

  // An empty restaurant catalogue is valid live data. If the authoritative database
  // has no restaurants, the public catalogue must be empty rather than resurrecting stale demo data.

  // Ensure all restaurants are valid objects with non-empty string id and name
  for (const r of candidate.restaurants) {
    if (!r || typeof r !== 'object') return false;
    if (typeof r.id !== 'string' || !r.id.trim()) return false;
    if (typeof r.name !== 'string' || !r.name.trim()) return false;
    // Reject fake or suspicious credentials if accidentally embedded
    if (r.password || r.password_hash || r.token || r.secret) return false;
  }

  if (candidate.deliveryZones && !Array.isArray(candidate.deliveryZones)) return false;
  if (candidate.promoCodes && !Array.isArray(candidate.promoCodes)) return false;
  if (candidate.platformSettings && typeof candidate.platformSettings !== 'object') return false;

  return true;
}

export class SiteDataManager {
  private currentSnapshot: SiteDataSnapshot | null = null;
  private lastSyncTimestamp: number = 0;
  private lastAttemptedTimestamp: number = 0;
  private consecutiveFailures: number = 0;
  private isSyncing: boolean = false;
  private inFlightRefreshPromise: Promise<SiteDataSnapshot | null> | null = null;
  private timer: NodeJS.Timeout | null = null;

  private primaryDiskPath: string;
  private tmpDiskPath: string;

  constructor(options?: { primaryDiskPath?: string; tmpDiskPath?: string; skipDiskLoad?: boolean }) {
    this.primaryDiskPath = options?.primaryDiskPath || path.resolve(process.cwd(), 'data', 'last-known-good-site-data.json');
    this.tmpDiskPath = options?.tmpDiskPath || path.resolve(os.tmpdir(), 'last-known-good-site-data.json');

    // Attempt synchronous initialization from local disk unless explicitly skipped
    if (!options?.skipDiskLoad) {
      this.loadFromDiskSync();
    }
  }

  private loadFromDiskSync(): void {
    // Vercel serverless filesystems are ephemeral and must not be treated as durable
    // production truth. Production recovery is from Cloudflare D1/R2 only.
    if (process.env.NODE_ENV === 'production') return;

    // Only load from disk if memory is empty
    if (this.currentSnapshot) return;

    try {
      if (fs.existsSync(this.primaryDiskPath)) {
        const raw = fs.readFileSync(this.primaryDiskPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isValidSiteData(parsed, { allowEmpty: true })) {
          this.currentSnapshot = {
            ...parsed,
            schemaVersion: parsed.schemaVersion || 1,
            source: 'disk_cache',
            syncStatus: 'fallback'
          };
          return;
        }
      }
    } catch {}

    try {
      if (fs.existsSync(this.tmpDiskPath)) {
        const raw = fs.readFileSync(this.tmpDiskPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isValidSiteData(parsed, { allowEmpty: true })) {
          this.currentSnapshot = {
            ...parsed,
            schemaVersion: parsed.schemaVersion || 1,
            source: 'disk_cache',
            syncStatus: 'fallback'
          };
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

  /** Last successful D1 catalogue that was stored and distributed. */
  public getLastSync(): SiteDataSnapshot | null {
    return this.getLastKnownGood();
  }

  public getRestaurants(): any[] {
    const snap = this.getLastKnownGood();
    return snap?.restaurants || [];
  }

  public getUpdatedAt(): string | null {
    const snap = this.getLastKnownGood();
    return snap?.updatedAt || null;
  }

  public getVersion(): number {
    const snap = this.getLastKnownGood();
    return snap?.version || 0;
  }

  public getStatus() {
    const snap = this.getLastKnownGood();
    return {
      version: snap?.version || 0,
      schemaVersion: snap?.schemaVersion || 1,
      updatedAt: snap?.updatedAt || null,
      lastAttemptedAt: snap?.lastAttemptedAt || null,
      source: snap?.source || 'none',
      syncStatus: snap?.syncStatus || 'stale',
      restaurantCount: snap?.restaurants?.length || 0,
      deliveryZonesCount: snap?.deliveryZones?.length || 0,
      promoCodesCount: snap?.promoCodes?.length || 0,
      consecutiveFailures: this.consecutiveFailures,
      persistedToD1: snap?.metadata?.persistedToD1 ?? false,
      persistedToR2: snap?.metadata?.persistedToR2 ?? false
    };
  }

  /**
   * Loads the snapshot with prioritized durability:
   * 1. Memory cache
   * 2. Authoritative Cloudflare D1 platform_settings table
   * 3. Cloudflare R2 bucket snapshot
   * 4. Local disk cache (development / emergency fallback)
   */
  public async loadSnapshot(): Promise<SiteDataSnapshot | null> {
    if (this.currentSnapshot && isValidSiteData(this.currentSnapshot, { allowEmpty: true })) {
      return this.currentSnapshot;
    }

    // 1. Authoritative Cloudflare D1 platform_settings table
    try {
      const d1Res = await d1.query(
        'SELECT value, updated_at FROM platform_settings WHERE key = ? LIMIT 1',
        ['last_known_good_site_data']
      );
      if (d1Res.results && d1Res.results.length > 0 && d1Res.results[0].value) {
        const parsed = JSON.parse(d1Res.results[0].value);
        if (isValidSiteData(parsed, { allowEmpty: true })) {
          this.currentSnapshot = {
            ...parsed,
            schemaVersion: parsed.schemaVersion || 1,
            source: 'cloudflare_d1',
            syncStatus: 'synced'
          };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] D1 snapshot read note:', e?.message || e);
    }

    // 2. Cloudflare R2 bucket
    try {
      if (r2.isConfigured()) {
        const r2Snapshot = await r2.getJson<SiteDataSnapshot>('data/last-known-good-site-data.json');
        if (isValidSiteData(r2Snapshot, { allowEmpty: true })) {
          this.currentSnapshot = {
            ...r2Snapshot,
            schemaVersion: r2Snapshot.schemaVersion || 1,
            source: 'cloudflare_r2',
            syncStatus: 'synced'
          };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;
        }
      }
    } catch (e: any) {
      console.warn('[SiteData] R2 snapshot read note:', e?.message || e);
    }

    // 3. Local disk snapshot fallback
    this.loadFromDiskSync();
    return this.currentSnapshot;
  }

  /**
   * Safely writes snapshot to local disk using atomic file rename
   */
  private persistToDisk(snapshot: SiteDataSnapshot): void {
    const jsonStr = JSON.stringify(snapshot, null, 2);

    try {
      const dataDir = path.dirname(this.primaryDiskPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const tmpFile = `${this.primaryDiskPath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.primaryDiskPath);
    } catch {}

    try {
      const tmpFile = `${this.tmpDiskPath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
      fs.renameSync(tmpFile, this.tmpDiskPath);
    } catch {}
  }

  /**
   * Saves a validated snapshot to memory, disk, Cloudflare D1, and Cloudflare R2.
   * Accurately tracks durable persistence and prevents version regressions.
   */
  public async saveSnapshot(
    snapshot: SiteDataSnapshot,
    options?: { allowEmpty?: boolean; isAuthorizedAdmin?: boolean }
  ): Promise<boolean> {
    if (!isValidSiteData(snapshot, { allowEmpty: true })) {
      console.error('[SiteData] Attempted to save invalid or empty site snapshot. Aborting.');
      return false;
    }

    // Monotonic versioning check: do not overwrite a newer snapshot with an older version
    if (this.currentSnapshot && snapshot.version < this.currentSnapshot.version) {
      console.warn(
        `[SiteData] Rejected version regression from ${this.currentSnapshot.version} to ${snapshot.version}.`
      );
      return false;
    }

    let persistedToD1 = false;
    let persistedToR2 = false;

    // 1. Persist to Cloudflare D1 platform_settings table
    try {
      const jsonStr = JSON.stringify(snapshot);
      const d1Res = await d1.query(
        `INSERT INTO platform_settings (key, value, description, updated_at)
         VALUES ('last_known_good_site_data', ?, 'Persistent last-known-good site data snapshot', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [jsonStr, snapshot.updatedAt]
      );
      if (d1Res && d1Res.success !== false) {
        persistedToD1 = true;
      }
    } catch (err: any) {
      console.warn('[SiteData] D1 snapshot save note:', err?.message || err);
    }

    // 2. Persist to Cloudflare R2 bucket
    if (r2.isConfigured()) {
      try {
        const r2Res = await r2.uploadJson('data/last-known-good-site-data.json', snapshot);
        if (r2Res.success) {
          // Verify cloud persistence by reading the saved snapshot back and validating it
          const readBack = await r2.getJson<SiteDataSnapshot>('data/last-known-good-site-data.json');
          if (readBack && readBack.version === snapshot.version) {
            persistedToR2 = true;
          }
        }
      } catch (err: any) {
        console.warn('[SiteData] R2 snapshot save note:', err?.message || err);
      }
    }

    // Update metadata with verified persistence report
    snapshot.metadata = {
      restaurantCount: snapshot.restaurants.length,
      deliveryZoneCount: snapshot.deliveryZones?.length || 0,
      promoCodeCount: snapshot.promoCodes?.length || 0,
      persistedToD1,
      persistedToR2,
      lastSuccessfulSync: new Date().toISOString()
    };

    this.currentSnapshot = snapshot;
    this.lastSyncTimestamp = Date.now();

    // 3. Persist atomically to local disk
    this.persistToDisk(snapshot);

    return true;
  }

  /**
   * Refreshes from authoritative Cloudflare D1.
   * Success: store+distribute that exact result (empty catalogue allowed) as last-known-good.
   * Failure: return getLastKnownGood() / getLastSync() — last successful D1 read only.
   * Never invent restaurants, prices, or demo menus.
   */
  public async refreshSnapshot(
    options?: { force?: boolean; allowEmpty?: boolean; isAuthorizedAdmin?: boolean }
  ): Promise<SiteDataSnapshot | null> {
    // If a refresh is already in-flight, return the existing promise to prevent duplicate requests
    if (this.inFlightRefreshPromise) {
      return this.inFlightRefreshPromise;
    }

    const now = Date.now();
    this.lastAttemptedTimestamp = now;

    // Exponential backoff check after repeated failures: 5s, 10s, 20s, max 60s
    if (!options?.force && this.consecutiveFailures > 0) {
      const backoffMs = Math.min(60000, 5000 * Math.pow(2, this.consecutiveFailures - 1));
      if (now - this.lastSyncTimestamp < backoffMs) {
        return this.getLastKnownGood();
      }
    }

    this.isSyncing = true;
    this.inFlightRefreshPromise = (async () => {
      try {
        const restRes = await d1.query('SELECT * FROM restaurants ORDER BY rating DESC', [], { cache: false });
        // A successful query with zero rows means the catalogue is genuinely empty.
        // A failed/malformed query must never be mistaken for an intentional deletion.
        if (!restRes || restRes.success === false || !Array.isArray(restRes.results)) {
          throw new Error('Authoritative restaurant query failed; refusing to publish an empty catalogue.');
        }
        const rawRows = restRes.results;

        // The D1 query succeeded, so its result is authoritative even when empty.
        // Never keep a populated snapshot merely because all restaurants were intentionally deleted.

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

        // Secrets + never publish embedded menu blobs (menu_items is the dish source).
        for (const r of restaurants) {
          delete r.password;
          delete r.password_hash;
          delete r.token;
          delete r.secret;
          delete r.categories;
          delete r.menuItems;
          delete r.menu_items;
        }

        const zonesRes = await d1.query('SELECT * FROM delivery_zones WHERE is_active = 1 OR is_active IS NULL').catch(() => ({ results: [] }));
        const promoRes = await d1.query('SELECT * FROM promo_codes WHERE is_active = 1').catch(() => ({ results: [] }));
        const settingsRes = await d1.query('SELECT key, value FROM platform_settings').catch(() => ({ results: [] }));

        // Public settings allowlist: never leak private keys, secrets or credentials
        const safeSettings: Record<string, any> = {};
        for (const s of (settingsRes.results || [])) {
          if (PUBLIC_SETTINGS_WHITELIST.has(s.key)) {
            try {
              safeSettings[s.key] = JSON.parse(s.value);
            } catch {
              safeSettings[s.key] = s.value;
            }
          }
        }

        const candidate: SiteDataSnapshot = {
          schemaVersion: 1,
          version: (this.currentSnapshot?.version || 0) + 1,
          updatedAt: new Date().toISOString(),
          lastAttemptedAt: new Date().toISOString(),
          source: 'cloudflare_d1',
          syncStatus: 'synced',
          restaurants,
          deliveryZones: zonesRes.results || [],
          promoCodes: sanitizePromoCodes(promoRes.results || []),
          platformSettings: safeSettings,
          metadata: {
            restaurantCount: restaurants.length,
            deliveryZoneCount: (zonesRes.results || []).length,
            promoCodeCount: (promoRes.results || []).length,
            persistedToD1: false,
            persistedToR2: false,
            lastSuccessfulSync: new Date().toISOString(),
            consecutiveFailures: 0
          }
        };

        if (isValidSiteData(candidate, { allowEmpty: true })) {
          const saved = await this.saveSnapshot(candidate, { allowEmpty: true, isAuthorizedAdmin: true });
          if (!saved) {
            this.consecutiveFailures++;
            console.warn('[SiteData] Snapshot persistence failed; the authoritative D1 result was not published as a durable snapshot.');
            return null;
          }
          this.consecutiveFailures = 0;
          return this.currentSnapshot || candidate;
        } else {
          this.consecutiveFailures++;
          console.warn('[SiteData] Candidate snapshot failed validation.');
          return null;
        }
      } catch (err: any) {
        this.consecutiveFailures++;
        // Outage: distribute last successful D1 snapshot only — never invent catalogue data.
        const lkg = this.getLastKnownGood();
        if (lkg) {
          console.warn(
            '[SiteData] D1 refresh failed; distributing last successful D1 snapshot v' +
              lkg.version +
              ':',
            err?.message || err
          );
          return {
            ...lkg,
            syncStatus: 'fallback' as const,
            lastAttemptedAt: new Date().toISOString(),
            metadata: {
              ...(lkg.metadata || {
                restaurantCount: lkg.restaurants?.length || 0,
                deliveryZoneCount: lkg.deliveryZones?.length || 0,
                promoCodeCount: lkg.promoCodes?.length || 0,
                persistedToD1: false,
                persistedToR2: false,
              }),
              consecutiveFailures: this.consecutiveFailures,
              lastError: String(err?.message || err),
            },
          };
        }
        console.warn(
          '[SiteData] D1 refresh failed and no last-known-good snapshot exists yet:',
          err?.message || err
        );
        return null;
      } finally {
        this.isSyncing = false;
        this.inFlightRefreshPromise = null;
      }
    })();

    return this.inFlightRefreshPromise;
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
    return this.refreshSnapshot({ force });
  }

  /**
   * Authorized admin workflow to clear all restaurants if intentionally desired.
   */
  public async adminClearAllRestaurants(): Promise<boolean> {
    const candidate: SiteDataSnapshot = {
      schemaVersion: 1,
      version: (this.currentSnapshot?.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      lastAttemptedAt: new Date().toISOString(),
      source: 'cloudflare_d1',
      syncStatus: 'synced',
      restaurants: [],
      deliveryZones: this.currentSnapshot?.deliveryZones || [],
      promoCodes: sanitizePromoCodes(this.currentSnapshot?.promoCodes),
      platformSettings: this.currentSnapshot?.platformSettings || {},
      metadata: {
        restaurantCount: 0,
        deliveryZoneCount: this.currentSnapshot?.deliveryZones?.length || 0,
        promoCodeCount: this.currentSnapshot?.promoCodes?.length || 0,
        persistedToD1: false,
        persistedToR2: false,
        lastSuccessfulSync: new Date().toISOString(),
        consecutiveFailures: 0
      }
    };

    return this.saveSnapshot(candidate, { allowEmpty: true, isAuthorizedAdmin: true });
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
