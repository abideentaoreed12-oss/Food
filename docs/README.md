# Documentation index

This directory is the source of truth for architecture, operational rules, audits, and migration plans. The product is being prepared as a **general marketplace platform**, not a food-only application. Existing Veyrang production behavior must remain stable until a separately tested migration is approved.

## Documents

- [Marketplace platform architecture](./MARKETPLACE_PLATFORM_ARCHITECTURE.md) — domain boundaries, recommended source layout, tenant/role model, design-system separation, and safe migration order.
- [Client cache policy](./CLIENT_CACHE_POLICY.md) — browser storage, server-authoritative values, freshness, and invalidation.
- [Production route audit](./PRODUCTION_ROUTE_AUDIT.md) — current dual-router warning, route inventory method, security checks, and release gates.

## Rules for future work

1. Read this index and the architecture document before moving files, changing product design, or introducing a new marketplace vertical.
2. Keep shared platform capabilities separate from vertical-specific catalog, fulfillment, and terminology.
3. Keep UI presentation separate from domain rules and API/data access.
4. Keep Next.js App Router as the documented production entry point unless an explicit architecture decision changes it. Do not treat Vite/Express files as active production routes without evidence.
5. Do not mass-move existing files merely to match a proposed folder tree. Migrate one bounded domain at a time, preserve import paths until updated, and run typecheck, tests, route audit, and production build.
6. Never introduce mock data, hardcoded production catalog values, or fabricated success/fallback behavior.
7. Update these documents when the actual runtime, providers, database schema, authorization model, or source layout changes.
