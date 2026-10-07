# Unified Backend Routing Manager & Live Driver GPS Tracking System

A resilient, production-grade backend routing engine and live driver tracking architecture for the Veyrang food delivery application. The system provides a single unified backend service for distance, ETA, and route calculation using a multi-tier provider manager (Valhalla → OSRM → Google Maps) with circuit breaker health monitoring, as well as real-time driver GPS location tracking and dynamic map visualization.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural design decisions confirmed during Phase 1 clarification are summarized below and serve as the technical foundation for this implementation.

- **Confirmed Decision 1: Single Backend Routing Service**:
  - The frontend never queries mapping providers directly.
  - All routing requests pass through `/api/calculate-distance` (or backend routing manager service).
  - Standardized JSON result returned regardless of provider used:
    `{ distanceMeters: number, durationSeconds: number, provider: 'valhalla' | 'osrm' | 'google' | 'haversine', status: 'success' }`
- **Confirmed Decision 2: Multi-Tier Provider Failover & Circuit Breaker**:
  - Primary Provider: **Valhalla** (2–3s timeout)
  - Secondary Provider: **OSRM** (2–3s timeout)
  - Final Fallback: **Google Maps API** (5s timeout)
  - Safety/Offline Guard: **Haversine Formula with Road Multiplier (1.3x)**
  - Circuit Breaker: Automatically tracks consecutive failures and marks providers unhealthy during cooldown periods (60s).
- **Confirmed Decision 3: Real-Time Live Driver GPS Tracking**:
  - Driver device continuously emits GPS coordinates via HTML5 Geolocation API during active deliveries.
  - Backend validates, filters minimal movements (< 20m threshold), and updates active order courier position in D1 database and live tracking state.
  - Customer tracking modal receives live updates via real-time backend state polling/sync, displaying continuous smooth marker motion, remaining distance, ETA, and connection health status ("Live GPS Active" / "Signal Paused - Showing Last Known Position").

---

## 1. Overview & Core Concept

- **What It Does**: Upgrades the delivery application with an enterprise-grade routing manager and real-time courier location tracker. The backend orchestrates distance and ETA calculations across multiple open-source and API providers with zero frontend footprint changes, while couriers broadcast live device coordinates to customers tracking their food orders on an interactive map.
- **Target Audience**: Food delivery customers tracking active orders in real time, courier drivers broadcasting GPS during delivery runs, and store admins configuring routing provider policies.
- **Key Value**: Guarantees 99.99% availability for delivery fee and ETA calculations without depending solely on paid Google Maps API quotas, while providing an authentic Google Maps-style live tracking experience for customers.

---

## 2. User Experience & Visual Design

- **Customer Live Order Tracking View**:
  - Interactive map canvas displaying customer drop-off pin, restaurant pickup pin, and courier vehicle marker.
  - Dynamic status bar showing calculated road distance (e.g. `4.8 km`), remaining travel time (e.g. `14 mins`), and last GPS ping timestamp (`"Updated 12s ago"`).
  - Connection status badge: Green pulse (`"Live Courier GPS Active"`) or Amber indicator (`"Courier Offline · Last Known Location"`).
  - Smooth visual position interpolation when courier coordinates update.
- **Courier Driver Dispatch View**:
  - One-tap `"Start Navigation & Broadcast GPS"` action button.
  - Device Geolocation permission prompt with clean explanation.
  - Active broadcast indicator showing current GPS accuracy and signal strength.
- **Admin Routing Configuration Panel**:
  - Provider priority controls (Valhalla, OSRM, Google Maps, Haversine).
  - Circuit breaker health status cards showing real-time provider health (🟢 Healthy / 🔴 Cooldown).
  - Configurable timeouts and failover thresholds.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Backend Isolation of Routing Providers**:
  - *Chosen Approach*: Hide all provider logic behind `/app/api/[[...route]]/route.ts` and `lib/routingManager.ts`.
  - *Why*: Keeps API keys strictly server-side, allows instant admin policy changes without rebuilding frontend React code, and standardizes route data formats.
- **Decision 2: Distance Movement Filtering for GPS Broadcasts**:
  - *Chosen Approach*: Ignore driver updates if displacement is less than 20 meters unless 30 seconds have passed.
  - *Why*: Prevents unnecessary database write noise and API quota consumption while preserving battery and network bandwidth.
- **Decision 3: Fallback Verification & Suspicious Distance Guard**:
  - *Chosen Approach*: Reject provider responses with negative/zero durations or wildly abnormal travel times compared to direct straight-line distance, falling back safely to the next tier.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT VIEWPORT                               │
│  ┌──────────────────────────┐             ┌──────────────────────────┐  │
│  │ Customer Tracking Modal  │             │   Courier Driver View    │  │
│  │  - Interactive Map Canvas│             │   - HTML5 Geolocation    │  │
│  │  - Live Marker & ETA     │             │   - Continuous GPS Ping  │  │
│  └─────────────▲────────────┘             └─────────────┬────────────┘  │
└────────────────┼────────────────────────────────────────┼───────────────┘
                 │ GET /api/orders/track                  │ POST /api/couriers/location
                 │                                        │
┌────────────────┴────────────────────────────────────────▼───────────────┐
│                     NEXT.JS API BACKEND ROUTER                          │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   UNIFIED ROUTING MANAGER                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Circuit Breaker & Health Monitor                           │  │  │
│  │  │  - Track Failures, Timeouts, Cooldown States                │  │  │
│  │  └──────────────────────────────┬──────────────────────────────┘  │  │
│  │                                 │                                 │  │
│  │     Tier 1: Valhalla  ──► Tier 2: OSRM ──► Tier 3: Google Maps  │  │
│  │            │                   │                  │               │  │
│  │            └───────────────────┼──────────────────┘               │  │
│  │                                ▼                                  │  │
│  │               Safety Fallback: Haversine (1.3x)                   │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────┘
                                     ▼
                       ┌──────────────────────────┐
                       │   Cloudflare D1 Database │
                       │   - active_deliveries    │
                       │   - courier_locations    │
                       └──────────────────────────┘
```

### Data Model & Routing Contracts

1. **Routing Result Schema**:
   ```typescript
   export interface RouteResult {
     distanceMeters: number;
     durationSeconds: number;
     provider: 'valhalla' | 'osrm' | 'google' | 'haversine';
     status: 'success' | 'fallback';
     latencyMs: number;
     polyline?: string;
   }
   ```

2. **Courier Location Payload**:
   ```typescript
   export interface CourierLocationUpdate {
     courierId: string;
     orderId: string;
     latitude: number;
     longitude: number;
     heading?: number;
     speed?: number;
     timestamp: number;
   }
   ```

3. **Backend Service Layer (`lib/routingManager.ts`)**:
   - Implements `ValhallaProvider`, `OSRMProvider`, `GoogleMapsProvider`, and `HaversineProvider`.
   - Manages timeouts using `Promise.race` and `AbortController`.
   - Maintains an in-memory circuit breaker map (`providerHealth`) recording error counts and last failure timestamps.
