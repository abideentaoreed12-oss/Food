/**
 * Unified Backend Routing Manager
 *
 * Implements a resilient multi-tier routing provider strategy:
 *   Primary: Valhalla Routing Engine (3s timeout)
 *   Secondary: OSRM Engine (3s timeout)
 *   Tertiary: Google Maps Platform API (5s timeout)
 *   Safety Fallback: Haversine Formula with 1.3x road factor (Instant)
 *
 * Features:
 * - Single standardized result output
 * - Circuit breaker health monitoring with automatic cooldowns
 * - Suspicious distance/duration validation
 */

import { CONFIG } from '../server/config';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  provider: 'valhalla' | 'osrm' | 'openrouteservice' | 'graphhopper' | 'google' | 'haversine';
  status: 'success' | 'fallback';
  latencyMs: number;
  polyline?: string;
  error?: string;
}

export interface ProviderHealth {
  name: 'valhalla' | 'osrm' | 'openrouteservice' | 'graphhopper' | 'google' | 'haversine';
  status: 'healthy' | 'cooldown' | 'disabled';
  consecutiveFailures: number;
  lastFailureTime?: number;
  cooldownUntil?: number;
  totalRequests: number;
  totalSuccesses: number;
}

class RoutingManager {
  private healthState: Record<string, ProviderHealth> = {
    valhalla: { name: 'valhalla', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 },
    osrm: { name: 'osrm', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 },
    openrouteservice: { name: 'openrouteservice', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 },
    graphhopper: { name: 'graphhopper', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 },
    google: { name: 'google', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 },
    haversine: { name: 'haversine', status: 'healthy', consecutiveFailures: 0, totalRequests: 0, totalSuccesses: 0 }
  };

  private readonly failureThreshold = 3;
  private readonly cooldownMs = 60000; // 60s cooldown when circuit trips

  private isProviderAvailable(providerName: string): boolean {
    const health = this.healthState[providerName];
    if (!health) return false;
    if (health.status === 'cooldown') {
      if (health.cooldownUntil && Date.now() > health.cooldownUntil) {
        // Cooldown expired, restore to healthy for trial
        health.status = 'healthy';
        health.consecutiveFailures = 0;
        return true;
      }
      return false;
    }
    return health.status === 'healthy';
  }

  private recordSuccess(providerName: string) {
    const health = this.healthState[providerName];
    if (health) {
      health.totalRequests += 1;
      health.totalSuccesses += 1;
      health.consecutiveFailures = 0;
      health.status = 'healthy';
    }
  }

  private recordFailure(providerName: string) {
    const health = this.healthState[providerName];
    if (health) {
      health.totalRequests += 1;
      health.consecutiveFailures += 1;
      health.lastFailureTime = Date.now();
      if (health.consecutiveFailures >= this.failureThreshold) {
        health.status = 'cooldown';
        health.cooldownUntil = Date.now() + this.cooldownMs;
      }
    }
  }

  public getHealth(): Record<string, ProviderHealth> {
    // Check for expired cooldowns before returning status
    const now = Date.now();
    Object.values(this.healthState).forEach((h) => {
      if (h.status === 'cooldown' && h.cooldownUntil && now > h.cooldownUntil) {
        h.status = 'healthy';
        h.consecutiveFailures = 0;
      }
    });
    return { ...this.healthState };
  }

  /**
   * Main entry point: Calculates route between origin and destination.
   * Tries primary (Valhalla) -> secondary (OSRM) -> fallback (Google) -> safety (Haversine).
   */
  public async calculateRoute(
    origin: RouteCoordinates,
    destination: RouteCoordinates
  ): Promise<RouteResult> {
    // Validate inputs
    if (!this.isValidCoord(origin) || !this.isValidCoord(destination)) {
      return this.calculateHaversine(origin, destination, 'Invalid coordinates provided');
    }

    // Tier 1: Valhalla
    if (this.isProviderAvailable('valhalla')) {
      const valhallaRes = await this.tryValhalla(origin, destination);
      if (valhallaRes) return valhallaRes;
    }

    // Tier 2: OSRM
    if (this.isProviderAvailable('osrm')) {
      const osrmRes = await this.tryOSRM(origin, destination);
      if (osrmRes) return osrmRes;
    }

    // Tier 3: OpenRouteService
    if (this.isProviderAvailable('openrouteservice')) {
      const orsRes = await this.tryOpenRouteService(origin, destination);
      if (orsRes) return orsRes;
    }

    // Tier 4: GraphHopper Engine (Keyless self-hosted or hosted with key)
    if (this.isProviderAvailable('graphhopper')) {
      const ghRes = await this.tryGraphHopper(origin, destination);
      if (ghRes) return ghRes;
    }

    // Tier 5: Google Maps API
    const googleKey = (CONFIG.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
    if (this.isProviderAvailable('google') && googleKey) {
      const googleRes = await this.tryGoogle(origin, destination);
      if (googleRes) return googleRes;
    }

    // Tier 6: Safety Fallback (Haversine Formula)
    return this.calculateHaversine(origin, destination);
  }

  private isValidCoord(coord: RouteCoordinates): boolean {
    return (
      typeof coord?.lat === 'number' &&
      typeof coord?.lng === 'number' &&
      !isNaN(coord.lat) &&
      !isNaN(coord.lng) &&
      coord.lat >= -90 &&
      coord.lat <= 90 &&
      coord.lng >= -180 &&
      coord.lng <= 180
    );
  }

  private validateResult(distMeters: number, durSeconds: number): boolean {
    // Distance must be > 0 and reasonable (< 10,000 km)
    // Duration must be > 0 and < 24 hours (86400s)
    return (
      distMeters > 0 &&
      distMeters < 10000000 &&
      durSeconds > 0 &&
      durSeconds < 86400
    );
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Tier 1: Valhalla Engine
   */
  private async tryValhalla(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult | null> {
    const startTime = Date.now();
    const rawValhalla = CONFIG.VALHALLA_BASE_URL || process.env.VALHALLA_BASE_URL || process.env.VALHALLA_URL || 'https://valhalla.openstreetmap.de';
    const cleanValhalla = rawValhalla.replace(/\/+$/, '').replace(/\/route$/, '');
    const apiKey = (CONFIG.VALHALLA_API_KEY || process.env.VALHALLA_API_KEY || '').trim();
    const valhallaUrl = `${cleanValhalla}/route${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`;

    try {
      const payload = {
        locations: [
          { lat: origin.lat, lon: origin.lng },
          { lat: destination.lat, lon: destination.lng }
        ],
        costing: 'auto',
        units: 'kilometers',
        directions_options: { units: 'kilometers' }
      };

      const response = await this.fetchWithTimeout(
        valhallaUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VeyraNG-FoodDelivery/2.1'
          },
          body: JSON.stringify(payload)
        },
        3500
      );

      if (!response.ok) {
        this.recordFailure('valhalla');
        return null;
      }

      const data = await response.json();
      const summary = data?.trip?.summary;
      if (summary && typeof summary.length === 'number' && typeof summary.time === 'number') {
        const distMeters = Math.round(summary.length * 1000); // Valhalla returns length in km
        const durSeconds = Math.round(summary.time);
        if (this.validateResult(distMeters, durSeconds)) {
          this.recordSuccess('valhalla');
          return {
            distanceMeters: distMeters,
            durationSeconds: durSeconds,
            provider: 'valhalla',
            status: 'success',
            latencyMs: Date.now() - startTime
          };
        }
      }
      this.recordFailure('valhalla');
      return null;
    } catch (err) {
      this.recordFailure('valhalla');
      return null;
    }
  }

  /**
   * Tier 2: OSRM Engine
   */
  private async tryOSRM(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult | null> {
    const startTime = Date.now();
    const osrmBase = (CONFIG.OSRM_BASE_URL || process.env.OSRM_BASE_URL || process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
    const url = `${osrmBase}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: { 'User-Agent': 'VeyraNG-FoodDelivery/2.1' }
        },
        3000
      );
      if (!response.ok) {
        this.recordFailure('osrm');
        return null;
      }

      const data = await response.json();
      const route = data?.routes?.[0];
      if (route && typeof route.distance === 'number' && typeof route.duration === 'number') {
        const distMeters = Math.round(route.distance);
        const durSeconds = Math.round(route.duration);
        if (this.validateResult(distMeters, durSeconds)) {
          this.recordSuccess('osrm');
          return {
            distanceMeters: distMeters,
            durationSeconds: durSeconds,
            provider: 'osrm',
            status: 'success',
            latencyMs: Date.now() - startTime
          };
        }
      }
      this.recordFailure('osrm');
      return null;
    } catch (err) {
      this.recordFailure('osrm');
      return null;
    }
  }

  /**
   * Tier 3: OpenRouteService Engine
   */
  private async tryOpenRouteService(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult | null> {
    const startTime = Date.now();
    const rawOrsBase = (CONFIG.OPENROUTESERVICE_BASE_URL || process.env.OPENROUTESERVICE_BASE_URL || process.env.ORS_BASE_URL || 'https://api.openrouteservice.org').replace(/\/+$/, '');
    const orsApiKey = (CONFIG.OPENROUTESERVICE_API_KEY || process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY || '').trim();

    // Hosted openrouteservice.org requires an API key. Self-hosted instances may be keyless.
    if (rawOrsBase.includes('openrouteservice.org') && !orsApiKey) {
      return null; // Skip gracefully if key is not configured for hosted ORS
    }

    const url = `${rawOrsBase}/v2/directions/driving-car`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VeyraNG-FoodDelivery/2.1'
    };
    if (orsApiKey) {
      headers['Authorization'] = orsApiKey;
    }

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            coordinates: [
              [origin.lng, origin.lat],
              [destination.lng, destination.lat]
            ]
          })
        },
        3500
      );

      if (!response.ok) {
        this.recordFailure('openrouteservice');
        return null;
      }

      const data = await response.json();
      const summary = data?.routes?.[0]?.summary;
      if (summary && typeof summary.distance === 'number' && typeof summary.duration === 'number') {
        const distMeters = Math.round(summary.distance);
        const durSeconds = Math.round(summary.duration);
        if (this.validateResult(distMeters, durSeconds)) {
          this.recordSuccess('openrouteservice');
          return {
            distanceMeters: distMeters,
            durationSeconds: durSeconds,
            provider: 'openrouteservice',
            status: 'success',
            latencyMs: Date.now() - startTime
          };
        }
      }
      this.recordFailure('openrouteservice');
      return null;
    } catch {
      this.recordFailure('openrouteservice');
      return null;
    }
  }

  /**
   * Tier 4: GraphHopper Routing Engine (Keyless self-hosted or hosted with API key)
   */
  private async tryGraphHopper(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult | null> {
    const startTime = Date.now();
    const rawGhBase = (CONFIG.GRAPHHOPPER_BASE_URL || process.env.GRAPHHOPPER_BASE_URL || process.env.GRAPHHOPPER_URL || 'https://graphhopper.com/api/1').replace(/\/+$/, '').replace(/\/route$/, '');
    const ghApiKey = (CONFIG.GRAPHHOPPER_API_KEY || process.env.GRAPHHOPPER_API_KEY || '').trim();
    const isHostedGh = rawGhBase.includes('graphhopper.com');

    // Hosted GraphHopper requires key; self-hosted instances run keyless
    if (isHostedGh && !ghApiKey) {
      return null;
    }

    const url = `${rawGhBase}/route?point=${origin.lat},${origin.lng}&point=${destination.lat},${destination.lng}&vehicle=car&locale=en&calc_points=true${ghApiKey ? `&key=${encodeURIComponent(ghApiKey)}` : ''}`;

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: { 'User-Agent': 'VeyraNG-FoodDelivery/2.1' }
        },
        3500
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[GraphHopper Router] Rate limit hit (429)');
        }
        this.recordFailure('graphhopper');
        return null;
      }

      const data = await response.json();
      const path = data?.paths?.[0];
      if (path && typeof path.distance === 'number' && typeof path.time === 'number') {
        const distMeters = Math.round(path.distance);
        const durSeconds = Math.round(path.time / 1000); // GraphHopper returns time in milliseconds
        if (this.validateResult(distMeters, durSeconds)) {
          this.recordSuccess('graphhopper');
          return {
            distanceMeters: distMeters,
            durationSeconds: durSeconds,
            provider: 'graphhopper',
            status: 'success',
            latencyMs: Date.now() - startTime,
            polyline: path.points || undefined
          };
        }
      }
      this.recordFailure('graphhopper');
      return null;
    } catch {
      this.recordFailure('graphhopper');
      return null;
    }
  }

  /**
   * Tier 5: Google Maps Distance Matrix / Directions API
   */
  private async tryGoogle(origin: RouteCoordinates, destination: RouteCoordinates): Promise<RouteResult | null> {
    const startTime = Date.now();
    const apiKey = (CONFIG.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
    if (!apiKey) return null;

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}`;

    try {
      const response = await this.fetchWithTimeout(url, { method: 'GET' }, 5000);
      if (!response.ok) {
        this.recordFailure('google');
        return null;
      }

      const data = await response.json();
      const element = data?.rows?.[0]?.elements?.[0];
      if (element && element.status === 'OK') {
        const distMeters = element.distance?.value || 0;
        const durSeconds = element.duration?.value || 0;
        if (this.validateResult(distMeters, durSeconds)) {
          this.recordSuccess('google');
          return {
            distanceMeters: distMeters,
            durationSeconds: durSeconds,
            provider: 'google',
            status: 'success',
            latencyMs: Date.now() - startTime
          };
        }
      }
      this.recordFailure('google');
      return null;
    } catch (err) {
      this.recordFailure('google');
      return null;
    }
  }

  /**
   * Tier 4: Safety Haversine Calculation (1.3x Road Factor)
   */
  public calculateHaversine(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    errorReason?: string
  ): RouteResult {
    const startTime = Date.now();
    const R = 6371e3; // metres
    const phi1 = (origin.lat * Math.PI) / 180;
    const phi2 = (destination.lat * Math.PI) / 180;
    const deltaPhi = ((destination.lat - origin.lat) * Math.PI) / 180;
    const deltaLambda = ((destination.lng - origin.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const straightLineMeters = R * c;
    // Apply 1.3x urban winding road multiplier
    const roadMeters = Math.round(straightLineMeters * 1.3);

    // Assume average city traffic speed of 30 km/h (8.33 m/s)
    const speedMps = 8.33;
    const durationSeconds = Math.max(180, Math.round(roadMeters / speedMps));

    this.recordSuccess('haversine');

    return {
      distanceMeters: Math.max(500, roadMeters),
      durationSeconds,
      provider: 'haversine',
      status: 'fallback',
      latencyMs: Date.now() - startTime,
      error: errorReason
    };
  }
}

export const routingManager = new RoutingManager();
