# Application Workers Audit & Overview

This plan provides a comprehensive breakdown and audit of all "worker" components across the Veyrang Food Delivery application architecture—spanning Cloudflare Edge Workers, Delivery Couriers (Drivers), and Runtime Background Workers.

> [!IMPORTANT]
> The application uses **1 Cloudflare Worker** gateway (`veyrang-api`), **Role-Based Couriers/Drivers** in the D1 database, and standard **Next.js/Node runtime worker threads**.

---

### 1. Cloudflare Workers (Edge API / Infrastructure)

- **Total Count**: **1 Primary Cloudflare Worker**
- **Worker Name & Endpoint**: `veyrang-api` (`https://veyrang-api.abideentaoreed12.workers.dev`)
- **Primary Function**:
  - Serves as the Cloudflare Edge API proxy fallback for database queries to **Cloudflare D1**.
  - Serves as the media upload gateway for **Cloudflare R2** bucket storage (review photos, partner media, restaurant assets).
- **Configuration Locations**:
  - `lib/d1.ts` (`CLOUDFLARE_WORKER_URL` fallback route)
  - `lib/r2.ts` (`storage/upload` proxy endpoints)

---

### 2. Delivery Workers (Couriers & Drivers)

- **Total Count**: Dynamic (Managed live in Cloudflare D1)
- **Role Identifier**: Users stored in the `users` table with `role = 'courier'`
- **Management & Monitoring**:
  - **Admin Route**: `/admin/drivers` (queries `SELECT * FROM users WHERE role = 'courier'`)
  - **Functionality**: Couriers are assigned to active delivery orders (`courier_id` field on `orders` and `reviews` tables).
  - **Live Audit**: Accessible via the **Admin Portal > Couriers / Drivers** view.

---

### 3. Application & Browser Runtime Workers

- **Next.js / Node Server Workers**:
  - **Count**: 1 Node.js process worker pool running `next dev` / `next start` (listening on port 3000).
  - Handles server-side API routing (`app/api/[[...route]]/route.ts`) and server component rendering.
- **Client Browser Web Workers / Service Workers**:
  - **Count**: **0 standalone Web Worker scripts** (standard single-thread client React hydration).

---

## Technical Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Veyrang App Architecture              │
└────────────────────────────┬────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Cloudflare  │     │   Delivery   │     │ Node Server  │
│    Worker    │     │   Couriers   │     │    Worker    │
│ (veyrang-api)│     │  (role =     │     │ (Next.js/    │
│ D1/R2 Proxy  │     │  'courier')  │     │  API Route)  │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Summary & Options

- **Confirmed Scope**: Provided full audit across all 3 categories of workers (Cloudflare Edge, Delivery Drivers, Runtime Server).
- **Next Steps**: Please review the implementation plan artifact. You can approve or request any changes!
