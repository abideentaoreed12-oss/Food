# SECURITY_PLAN.md

## A. Findings Table (Task 1)

| ID | Title | Severity | Evidence (file:line) | Status |
|----|---|---|---|---|
| F01 | /api/cron/sync accepts anonymous calls | High | app/api/cron/sync/route.ts:12 | Confirmed |
| F02 | /api/health/d1 exposes infrastructure info & table counts | Medium | app/api/[[...route]]/route.ts:177 | Confirmed |
| F03 | Cloudflare Worker is public with CORS '*' | High | External / Needs manual check | Needs manual check in dashboard |
| F04 | /api/storage/status leaks R2 & Worker details | Medium | app/api/[[...route]]/route.ts:219 | Confirmed |
| F05 | /api/auth/forgot-password user enumeration | Medium | app/api/[[...route]]/route.ts:2210 | Confirmed |
| F06 | Missing rate limiting on auth endpoints | High | app/api/[[...route]]/route.ts (auth handlers) | Confirmed |
| F07 | Public APIs expose internal IDs & business metadata | Low | app/api/[[...route]]/route.ts:267, 332 | Confirmed |
| F08 | /admin SPA shell reachable | Low | app/page.tsx / app/admin | Confirmed |
| F09 | Weak CSP ('unsafe-inline', 'unsafe-eval', no frame-ancestors) | Medium | next.config.mjs:8 | Confirmed |
| F10 | Overly permissive connect-src (https:, wss:) | Medium | next.config.mjs:19 | Confirmed |
| F11 | /api/geocode/autocomplete open to quota abuse | Medium | app/api/[[...route]]/route.ts | Confirmed |
| F12 | Resend webhook GET reveals configuration status | Low | app/api/webhooks/resend/route.ts:155 | Confirmed |
| F13 | Duplicate payment verification paths & overlapping routes | Low | app/api/[[...route]]/route.ts | Confirmed |

---

## B. Deep Security Audit (Task 2)

### 1. Git History Secret Scan
- **Findings**: No `.git` repository exists in this environment (`fatal: not a git repository`). No plaintext secrets found in working tree.

### 2. IDOR (Insecure Direct Object Reference)
- **Findings**: **Confirmed**. In `app/api/[[...route]]/route.ts:575`, `GET /orders/:id` checks authentication (`getUser(req)`) but does **not** verify whether `customer_id === user.id` (or if the user is the assigned restaurant/courier/admin). Any authenticated user can supply another user's order ID and view order details, items, totals, and handover PINs.

### 3. Payments & Webhooks
- **Findings**: 
  - **Server-side totals**: Computed server-side during quote/order creation (`app/api/[[...route]]/route.ts:1009`).
  - **Paystack Webhook**: Uses HMAC SHA512 signature verification (`x-paystack-signature`) with timing-safe comparison.
  - **Idempotency**: Checked via transaction reference uniqueness / payment status updates (`UPDATE orders SET payment_status = 'paid' WHERE transaction_ref = ?`).
  - **Race conditions**: Wallet debit/credit operations use atomic-like SQL updates or transactions where implemented, but concurrent requests should be guarded with database locks/unique constraints.

### 4. Authentication & JWT Hygiene
- **Findings**: 
  - **JWT Secret**: Falls back to default/demo secrets if environment variable is missing (`lib/auth.ts`).
  - **Cookies**: HttpOnly, secure (in production), sameSite flags are used, but cookie configuration should be strictly audited.
  - **Bcrypt**: Used with standard cost factor.
  - **Role Checks**: Some routes inside the catch-all router (`app/api/[[...route]]/route.ts`) check `user.role`, but individual administrative or restaurant routes must rigorously validate ownership/roles.

### 5. SQL Injection
- **Findings**: **No issue found**. All D1 queries in `app/api/[[...route]]/route.ts` and `lib/d1.ts` use parameterized query arrays (`[param1, param2]`) rather than string concatenation or template literal SQL injection.

### 6. Uploads & SSRF
- **Findings**: R2 file uploads validate content types/base64 structures. No arbitrary user-supplied URL server-side fetch (SSRF vector) identified in geocode routes.

### 7. Error Responses & Logs
- **Findings**: Some catch blocks return `err?.message` or raw error strings to the client, which can occasionally leak internal details.

### 8. Dependency Vulnerabilities (`npm audit --omit=dev`)
- **Findings**: **0 vulnerabilities found**. Upgrading packages is currently not required for known high/critical CVEs.

### 9. Cloudflare Worker Source
- **Findings**: Worker source code is not present in this repository. Must be verified in the Cloudflare Dashboard (CORS headers, route authentication, root JSON payload).
