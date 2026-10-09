/**
 * In-memory server-side query cache with short TTL.
 * Used for read-heavy public catalog data (restaurants, settings, zones).
 * NEVER caches wallet balances, order totals, or auth secrets.
 *
 * Default TTL: 10 seconds — max staleness for admin catalog updates.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 10_000;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheInvalidate(prefixOrKey?: string): void {
  if (!prefixOrKey) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      store.delete(key);
    }
  }
}

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  cacheSet(key, value, ttlMs);
  return value;
}

/** Cache key namespaces used across the app */
export const CacheKeys = {
  restaurants: (suffix = 'all') => `restaurants:${suffix}`,
  restaurant: (id: string) => `restaurant:${id}`,
  settings: () => 'settings:public',
  zones: () => 'zones:active',
  menu: (restaurantId: string) => `menu:${restaurantId}`,
} as const;

export const QUERY_CACHE_TTL_MS = DEFAULT_TTL_MS;
