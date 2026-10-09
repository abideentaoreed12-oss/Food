# Production route audit

## Objective

Maintain one verifiable inventory of page URLs and API handlers, and prevent source-code route counts from being mistaken for routes that actually work in production.

## Runtime finding

The repository has two routing systems:

- **Next.js App Router** under `app/`, started by the `build` / `start` scripts in `package.json`.
- **Express routers** under `server/routes/`, mounted in `server/app.ts` and intended for the separate Express entry point.

The standard `npm start` script runs `next start -p 3000`. An Express router declaration alone does not register a handler in Next.js. Each required Express capability must either be migrated to a Next.js route handler (preferred when Vercel/Next.js is the single runtime) or be explicitly routed to a separately deployed Express service. Do not assume the catch-all route implements all Express functionality.

## Inventory command

Run:

```bash
npm run routes:audit
```

The script lists page files, Next.js API route files and exported HTTP methods, plus Express route declarations and their mount prefixes. It is a source inventory, not a live-production probe; dynamic paths, middleware, aliases and routes implemented by a catch-all still require manual verification.

## Required route registry columns

For each business capability, track:

| Field | Required evidence |
| --- | --- |
| Page / API path and HTTP method | File path and explicit handler |
| Runtime | Next.js, Express service, or external provider |
| Frontend caller | Component/hook and exact request URL |
| Auth and authorization | Unauthenticated, customer, restaurant, courier, admin |
| Data dependency | Database tables / provider / environment variables |
| Expected responses | Success, validation, unauthenticated, forbidden, not found, dependency failure |
| Test | Automated test and latest result |
| Production verification | URL, method, timestamp, response status |

## Coverage groups to verify

1. Authentication, registration, login, logout, verification and recovery.
2. Restaurants, restaurant details, search, reviews and geocoding.
3. Orders, quotes, promo validation, status and tracking.
4. Payments, wallet funding, virtual accounts, callbacks and signed webhooks.
5. Admin overview, users/staff, restaurant operations, settings, delivery zones and promotions.
6. Support tickets, customer replies, admin responses and ticket status.
7. Storage upload, file access and deletion.
8. Health checks and protected database diagnostics.
9. Customer, restaurant, courier and admin page URLs, including direct navigation and refresh.
10. Legal, contact and help pages.

## Release gates

- [ ] Run `npm run routes:audit` and review all unmounted Express handlers.
- [ ] Run `npm run lint`, `npm test` and `npm run build`.
- [ ] Add automated route tests for each registered URL + HTTP method.
- [ ] Test direct page navigation and refresh on the production-like server.
- [ ] Verify authentication and role checks on server-side handlers.
- [ ] Verify provider/database failures return truthful non-2xx responses, never fake success.
- [ ] Verify payment webhook signatures, idempotency and wallet/order transaction consistency.
- [ ] Verify production environment variables and database credentials separately from route existence.
- [ ] Deploy only after checks pass; run smoke tests against the deployment.

## Safety rules

- Do not generate empty placeholder endpoints merely to increase route count.
- Do not duplicate an existing URL + method without deciding which implementation is authoritative.
- Do not expose admin or diagnostic routes to public users.
- Do not log tokens, payment secrets, full payment credentials or unnecessary personal data.
- A route is **complete** only when its caller, handler, authorization, data dependency, tests and production behavior all agree.
