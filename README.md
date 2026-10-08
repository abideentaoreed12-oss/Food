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

- **Web framework:** Next.js 15
- **UI:** React 19, TypeScript, Tailwind CSS
- **Icons and motion:** Lucide React, Motion
- **Backend/API:** Node.js and Express components, with JWT-based authentication
- **Database and storage configuration:** Cloudflare D1 and R2
- **Payments:** Paystack integration
- **Maps:** Google Maps integration (optional; requires API key)

## Requirements

- Node.js 18 or newer
- npm

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Use `.env.example` as the reference for the environment variables required by your deployment. Create a local `.env` file and fill in the values needed for the services you intend to run.

**Never commit real API keys, database tokens, payment secrets, JWT secrets, or administrator credentials to Git.** Keep production secrets in your hosting provider's environment settings. Do not enable demo seed data in production.

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
npm run lint
```

The `lint` script currently runs TypeScript's no-emit check.

## Environment and Integrations

Configure only the integrations you use, based on `.env.example`, including:

- Cloudflare D1 and R2
- Paystack
- Google Maps
- JWT authentication
- Optional email and AI services

Some features will be unavailable until their required environment variables and provider services are configured.

## Testing

The package defines an `npm test` script. Ensure the test runner and test dependencies are installed before running it.

## Deployment Notes

Deploy this application using a host that supports the project's Next.js version and Node.js runtime. Configure production environment variables in the hosting platform, verify database connectivity and payment webhooks, and run a production build before directing live traffic.

---

*Veyrang Food Delivery Platform — All Rights Reserved.*
