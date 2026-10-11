# Veyrang — Premium Food Delivery Platform

Veyrang is a multi-restaurant food delivery platform designed for Nigerian customers, restaurants, riders, and administrators. It brings restaurant discovery, ordering, payments, delivery tracking, and operational tools into one application.

## Features

- **Restaurant discovery:** Browse restaurants and menus, search, and filter available options.
- **Ordering and cart:** Manage items and customizations before checkout.
- **Wallet and payments:** Supports the platform's configured payment and wallet flows, including Paystack integration.
- **Order status and delivery tracking:** Follow order progress from placement through preparation, dispatch, and delivery.
- **Customer portal:** Manage orders, saved addresses, favourites, account details, and support.
- **Restaurant / kitchen portal:** Manage incoming orders and preparation status.
- **Courier portal:** Support delivery progress and rider operations.
- **Admin portal:** Manage platform operations and configured business settings.

Availability of individual features depends on environment configuration and backend setup.

## Technology Stack

- **Web framework:** Next.js 15 (App Router)
- **UI:** React 19, TypeScript, Tailwind CSS
- **Icons and motion:** Lucide React, Motion
- **Backend/API:** Next.js Route Handlers (`app/api/*`) with JWT-based authentication
- **Database and storage:** Cloudflare D1 (authoritative SQL database) and Cloudflare R2 (asset storage)
- **Payments:** Paystack integration with SHA-512 HMAC webhook verification
- **Maps & Geocoding:** Photon, Nominatim, and OSRM/Valhalla routing chain (with optional Google Maps client UI)

## Requirements

- Node.js 22.x
- npm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Use `.env.example` as the reference for the environment variables required by your deployment. Create a local `.env` file and fill in the values needed for the services you intend to run.

**Never commit real API keys, database tokens, payment secrets, JWT secrets, or administrator credentials to Git.** Keep production secrets in your hosting provider's environment settings.

### 3. Start the Next.js development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run the production build

```bash
npm run build
npm start
```

The production server uses port 3000 by default, as configured in the package scripts.

### 5. Type-check the project

```bash
npm run typecheck
```

Runs TypeScript's `tsc --noEmit` validation check.

## Environment and Integrations

Configure only the integrations you use, based on `.env.example`, including:

- Cloudflare D1 and R2
- Paystack
- Google Maps
- JWT authentication
- Optional email and AI services

Some features will be unavailable until their required environment variables and provider services are configured.

## Location and routing (no API key or self-hosting required)

The delivery backend uses public OpenStreetMap-based services by default:

- **Address search:** Photon, then Nominatim.
- **Road routing:** OSRM, then the public Valhalla service, then the public OSRM-compatible OpenStreetMap routing endpoint.
- **Reverse geocoding:** Nominatim, then Photon.
- **Pricing:** Active delivery-zone rates and radius from D1 when an assigned/unique zone is available; otherwise a configured restaurant fee and radius are required.
- **Failure behavior:** If no real router returns a valid road route, checkout fails with an availability error. The app does not replace a failed route with straight-line distance, guessed travel time, synthetic route geometry, or simulated courier GPS.

These are public community/demo endpoints: they do not require your own server or API key, but they are **not guaranteed permanent, unlimited, or SLA-backed**. They may rate-limit requests or change availability. Keep the default URLs in `.env.example` unless you intentionally choose another compatible public endpoint. Do not configure Google Maps, GraphHopper, or OpenRouteService credentials for the delivery-routing chain.

Google Maps is optional for map display components only; it is not used to calculate delivery distance, ETA, or fees. `GEMINI_API_KEY` is an optional placeholder and is not used to invent coordinates or routes.

## Testing

The package defines an `npm test` script. Ensure the test runner and test dependencies are installed before running it.

## Deployment Notes

Deploy this application using a host that supports the project's Next.js version and Node.js runtime. Configure production environment variables in the hosting platform, verify database connectivity and payment webhooks, and run a production build before directing live traffic.

---

*Veyrang Food Delivery Platform — All Rights Reserved.*
