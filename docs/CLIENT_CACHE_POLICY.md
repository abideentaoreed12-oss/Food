# Veyrang client storage & query cache policy

## Browser storage (localStorage)

**Allowed**
- `veyrang_jwt_token` — auth token
- `veyrang_user_shell` — id, email, name, role, phone, address (no wallet)
- `veyrang_cart_structural_v2` — menuItemId, qty, option IDs only
- `veyrang_active_page` — UI navigation
- `veyrang_favourites` — preference IDs

**Forbidden (server is source of truth)**
- Item prices, delivery/service fees
- Restaurant open/busy flags
- Wallet balances
- Promo discount amounts / order totals

## Server query cache

- Module: `lib/queryCache.ts`
- Default TTL: **10 seconds**
- Cached: restaurants list, restaurant by id, public settings, active zones
- Invalidated on admin/merchant writes (menu, restaurant, zones, settings) and `POST /admin/cache/purge`

## Client freshness

- Background poll every **10s** via `refreshData`
- Cart open and checkout trigger an immediate `refreshData`
- Cart line prices rehydrated from live catalog; unavailable items removed with user notice
- **Place order** always recalculates totals and prices against live D1 on the server
