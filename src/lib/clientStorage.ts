/**
 * Client storage policy for Veyrang.
 *
 * ALLOWED in localStorage / sessionStorage:
 *  - Auth token (JWT)
 *  - UI preferences (active page, theme)
 *  - Structural cart (item IDs + qty + option IDs only — never live prices)
 *  - Non-authoritative user profile shell (no wallet balances)
 *
 * FORBIDDEN (server is sole source of truth):
 *  - Item prices, delivery fees, service fees
 *  - Restaurant open / busy / availability flags
 *  - Wallet balances
 *  - Promo discount amounts
 *  - Order totals
 */

export const STORAGE_KEYS = {
  JWT: 'veyrang_jwt_token',
  USER_SHELL: 'veyrang_user_shell',
  /** @deprecated removed — was caching wallet balances */
  USER_CACHE_LEGACY: 'veyrang_user_cache',
  CART_STRUCTURAL: 'veyrang_cart_structural_v2',
  /** @deprecated full cart with prices */
  CART_LEGACY: 'veyrang_cart_v1',
  ACTIVE_PAGE: 'veyrang_active_page',
  FAVOURITES: 'veyrang_favourites',
} as const;

export type StructuralCartItem = {
  cartItemId: string;
  menuItemId: string;
  restaurantId: string;
  quantity: number;
  selectedOptions: Array<{
    optionId: string;
    optionName?: string;
    groupId?: string;
    groupName?: string;
  }>;
  specialInstructions?: string;
};

export function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota / private mode
  }
}

export function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** Strip authoritative fields before any client cache write */
export function toUserShell(user: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!user || typeof user !== 'object') return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? '',
    address: user.address ?? '',
    restaurantId: user.restaurantId,
    savedAddresses: Array.isArray(user.savedAddresses) ? user.savedAddresses : [],
    // Explicitly omit walletBalanceNGN / walletBalanceUSD
  };
}

export function loadStructuralCart(): StructuralCartItem[] {
  const raw = safeGet(STORAGE_KEYS.CART_STRUCTURAL);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  // One-time migration from legacy full cart
  const legacy = safeGet(STORAGE_KEYS.CART_LEGACY);
  if (legacy) {
    try {
      const items = JSON.parse(legacy);
      if (Array.isArray(items)) {
        const structural: StructuralCartItem[] = items
          .filter((it: any) => it?.menuItem?.id)
          .map((it: any) => ({
            cartItemId: it.cartItemId || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            menuItemId: it.menuItem.id,
            restaurantId: it.menuItem.restaurantId || '',
            quantity: Number(it.quantity) || 1,
            selectedOptions: (it.selectedOptions || []).map((o: any) => ({
              optionId: o.optionId || o.id,
              optionName: o.optionName || o.name,
              groupId: o.groupId,
              groupName: o.groupName,
            })),
            specialInstructions: it.specialInstructions,
          }));
        saveStructuralCart(structural);
        safeRemove(STORAGE_KEYS.CART_LEGACY);
        return structural;
      }
    } catch {}
  }
  return [];
}

export function saveStructuralCart(items: StructuralCartItem[]): void {
  safeSet(STORAGE_KEYS.CART_STRUCTURAL, JSON.stringify(items));
}

export function clearAuthStorage(): void {
  safeRemove(STORAGE_KEYS.JWT);
  safeRemove(STORAGE_KEYS.USER_SHELL);
  safeRemove(STORAGE_KEYS.USER_CACHE_LEGACY);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch {}
  }
}

/** Purge legacy keys that may have stored authoritative data */
export function purgeLegacyAuthoritativeCaches(): void {
  safeRemove(STORAGE_KEYS.USER_CACHE_LEGACY);
  safeRemove(STORAGE_KEYS.CART_LEGACY);
}
