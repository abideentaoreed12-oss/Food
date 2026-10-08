import * as geolib from 'geolib';
import * as turf from '@turf/turf';
import { CONFIG } from '../config.ts';

export interface GeoLocation {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface DistanceCalculationResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  estimatedDeliveryFee: number;
  inDeliveryRadius: boolean;
  userLocation?: GeoLocation;
  restaurantLocation?: GeoLocation;
  isLiveGoogleMaps: boolean;
  routingEngine?: 'Google Maps' | 'OSRM' | 'OpenStreetMap Routing' | 'Valhalla' | 'GraphHopper' | 'OpenRouteService' | 'Haversine';
}

// Global Circuit Breaker State for Google Maps API Quota Management
let googleMapsQuotaExceededUntil = 0; // Timestamp in ms
const COOLDOWN_DURATION_MS = 15 * 60 * 1000; // 15 minutes cooldown when rate limited

/**
 * Checks if Google Maps is currently available or in quota cooldown.
 */
export function isGoogleMapsQuotaAvailable(): boolean {
  if (Date.now() < googleMapsQuotaExceededUntil) {
    const minutesLeft = Math.ceil((googleMapsQuotaExceededUntil - Date.now()) / 60000);
    console.log(`[GeoRouting Circuit Breaker] Google Maps quota paused for ${minutesLeft} min. Utilizing live open-source fallback engine.`);
    return false;
  }
  return true;
}

/**
 * Triggers circuit breaker cooldown when Google Maps returns quota/rate limit error.
 */
export function markGoogleMapsQuotaExceeded(reason: string): void {
  googleMapsQuotaExceededUntil = Date.now() + COOLDOWN_DURATION_MS;
  console.warn(`[GeoRouting Circuit Breaker] Google Maps limit hit (${reason}). Auto-switched to OSRM / OpenRouteService / Nominatim fallbacks for 15 minutes.`);
}

/**
 * Geodesic distance calculation powered by open-source Geolib & Turf.js adjusted with urban road factor.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  try {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);
    const straightLineKm = turf.distance(point1, point2, { units: 'kilometers' });
    const roadDistanceKm = straightLineKm * 1.32;
    return Math.round(roadDistanceKm * 10) / 10;
  } catch (e) {
    const straightLineMeters = geolib.getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    );
    const straightLineKm = straightLineMeters / 1000;
    const roadDistanceKm = straightLineKm * 1.32;
    return Math.round(roadDistanceKm * 10) / 10;
  }
}

/**
 * Geocodes an address to live latitude & longitude using a 4-tier failover chain:
 * Tier 1: Google Maps Geocoding API
 * Tier 2: OpenStreetMap Nominatim
 * Tier 3: Photon Komoot
 * Tier 4: BigDataCloud
 */
export async function geocodeAddress(addressStr: string): Promise<GeoLocation & { isLive: boolean; provider?: string }> {
  const cleanAddr = (addressStr || '').trim();
  if (!cleanAddr) {
    throw new Error('A customer or restaurant address is required for live distance calculation');
  }

  // Open-source, no-key geocoding providers only.
  // Tier 1: OpenStreetMap Nominatim Geocoder
  try {
    const nomUrl = `${CONFIG.NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(
      cleanAddr + ', Nigeria'
    )}&limit=1`;
    const nomRes = await fetch(nomUrl, {
      headers: { 'User-Agent': 'VeyraNG-FoodDelivery-RoadRouter/2.0' },
      signal: AbortSignal.timeout(2500)
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        return {
          lat: parseFloat(nomData[0].lat),
          lng: parseFloat(nomData[0].lon),
          formattedAddress: nomData[0].display_name || cleanAddr,
          isLive: true,
          provider: 'OpenStreetMap Nominatim'
        };
      }
    }
  } catch (e: any) {
    console.log('Nominatim geocode fallback note:', e?.message || String(e));
  }

  // Tier 3: Photon Komoot Geocoder
  try {
    const photonUrl = `${CONFIG.PHOTON_BASE_URL}/api/?q=${encodeURIComponent(cleanAddr)}&limit=1`;
    const pRes = await fetch(photonUrl, {
      headers: { 'User-Agent': 'VeyraNG-FoodDelivery-RoadRouter/2.0' },
      signal: AbortSignal.timeout(2500)
    });
    if (pRes.ok) {
      const pData = await pRes.json();
      const feature = pData.features?.[0];
      if (feature && feature.geometry && feature.geometry.coordinates) {
        const [lon, lat] = feature.geometry.coordinates;
        return {
          lat,
          lng: lon,
          formattedAddress: feature.properties?.name || cleanAddr,
          isLive: true,
          provider: 'Photon Komoot'
        };
      }
    }
  } catch (e: any) {
    console.log('Photon geocode fallback note:', e?.message || String(e));
  }

  throw new Error('Could not geocode the supplied address with open-source providers');

}

/**
 * Calculates live driving road distance & traffic duration using a 4-tier failover chain:
 * 1. OSRM public routing (open source)
 * 2. OpenStreetMap public routing endpoint (open source)
 * 3. Optional operator-managed Valhalla (open source, no API key required)
 * 4. Fail closed when no live road-routing provider can verify a route
 */
export async function calculateDistanceAndDuration(
  origin: GeoLocation | string,
  destination: GeoLocation | string
): Promise<{
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  isLive: boolean;
  routingEngine: 'Google Maps' | 'OSRM' | 'OpenStreetMap Routing' | 'Valhalla' | 'GraphHopper' | 'OpenRouteService' | 'Haversine';
  originGeo: GeoLocation;
  destGeo: GeoLocation;
}> {
  let originGeo: GeoLocation;
  let destGeo: GeoLocation;

  if (typeof origin === 'string') {
    const geo = await geocodeAddress(origin);
    originGeo = { lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress };
  } else {
    originGeo = origin;
  }

  if (typeof destination === 'string') {
    const geo = await geocodeAddress(destination);
    destGeo = { lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress };
  } else {
    destGeo = destination;
  }

  // Open-source, no-key road routing only.
  // Tier 1: OSRM Road Routing API
  try {
    const osrmUrl = `${CONFIG.OSRM_BASE_URL}/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(2500) });
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        return {
          distanceKm,
          distanceText: `${distanceKm} km`,
          durationMinutes,
          durationText: `${durationMinutes}–${durationMinutes + 8} min`,
          isLive: true,
          routingEngine: 'OSRM',
          originGeo,
          destGeo
        };
      }
    }
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || err?.message?.includes('aborted')) {
      console.log('OSRM live routing API timed out (falling back to tertiary engine)');
    } else {
      console.log('OSRM live routing fallback note:', err?.message || String(err));
    }
  }

  // Tier 2: Public OpenStreetMap Routing Engine
  try {
    const orsUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=false`;
    const orsRes = await fetch(orsUrl, { signal: AbortSignal.timeout(2500) });
    if (orsRes.ok) {
      const orsData = await orsRes.json();
      if (orsData.code === 'Ok' && orsData.routes && orsData.routes.length > 0) {
        const route = orsData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        return {
          distanceKm: Math.max(0.4, distanceKm),
          distanceText: `${Math.max(0.4, distanceKm)} km`,
          durationMinutes,
          durationText: `${durationMinutes}–${durationMinutes + 8} min`,
          isLive: true,
          routingEngine: 'OpenStreetMap Routing',
          originGeo,
          destGeo
        };
      }
    }
  } catch (err: any) {
    console.log('OpenRouteService fallback note:', err?.message || String(err));
  }

  // Tier 4: Optional operator-managed Valhalla routing endpoint (open source).
  if (CONFIG.VALHALLA_BASE_URL) {
    try {
      const params = new URLSearchParams({
        json: JSON.stringify({
          locations: [
            { lat: originGeo.lat, lon: originGeo.lng },
            { lat: destGeo.lat, lon: destGeo.lng }
          ],
          costing: 'auto',
          units: 'kilometers'
        })
      });
      if (CONFIG.VALHALLA_API_KEY) params.set('api_key', CONFIG.VALHALLA_API_KEY);
      const response = await fetch(`${CONFIG.VALHALLA_BASE_URL}/route?${params}`, {
        headers: { 'X-Client-Id': 'veyrang-food-delivery' },
        signal: AbortSignal.timeout(3500)
      });
      if (response.ok) {
        const data = await response.json();
        const summary = data.trip?.summary;
        if (summary && Number.isFinite(summary.length) && Number.isFinite(summary.time)) {
          const distanceKm = Math.round(summary.length * 10) / 10;
          const durationMinutes = Math.max(1, Math.round(summary.time / 60));
          return {
            distanceKm, distanceText: `${distanceKm} km`,
            durationMinutes, durationText: `${durationMinutes} min`,
            isLive: true, routingEngine: 'Valhalla', originGeo, destGeo
          };
        }
      }
    } catch (error: any) {
      console.warn('[Routing] Valhalla provider failed; trying next provider:', error?.message || String(error));
    }
  }

  // Fail closed. Straight-line distance and guessed road multipliers must never be
  // presented as a verified driving route or used to quote delivery pricing.
  throw new Error('Live road routing is unavailable. No verified distance or delivery quote can be provided right now.');
}

/**
 * Calculates live distance metrics and dynamic delivery fee between customer address and restaurant.
 */
export async function calculateRestaurantDistanceMetrics(
  restaurant: any,
  userAddressOrCoords: string | { lat: number; lng: number }
): Promise<DistanceCalculationResult> {
  const restaurantLat = Number(restaurant.lat);
  const restaurantLng = Number(restaurant.lng);
  if (!Number.isFinite(restaurantLat) || !Number.isFinite(restaurantLng) || restaurantLat < -90 || restaurantLat > 90 || restaurantLng < -180 || restaurantLng > 180) {
    throw new Error('Restaurant location coordinates are missing or invalid in D1');
  }
  const restaurantLocation: GeoLocation = {
    lat: restaurantLat,
    lng: restaurantLng,
    formattedAddress: restaurant.address || 'Restaurant Kitchen'
  };

  let userLocation: GeoLocation;
  if (typeof userAddressOrCoords === 'string') {
    const geo = await geocodeAddress(userAddressOrCoords);
    userLocation = { lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress };
  } else {
    userLocation = {
      lat: userAddressOrCoords.lat,
      lng: userAddressOrCoords.lng
    };
  }

  const { distanceKm, distanceText, durationMinutes, durationText, isLive, routingEngine } =
    await calculateDistanceAndDuration(userLocation, restaurantLocation);

  // Live dynamic delivery fee calculation: Base fee + ₦150 per km beyond 2 km
  const baseDeliveryFee = Number(restaurant.deliveryFee);
  if (!Number.isFinite(baseDeliveryFee) || baseDeliveryFee < 0) {
    throw new Error('Restaurant delivery fee is missing or invalid in D1');
  }
  let estimatedDeliveryFee = baseDeliveryFee;

  if (distanceKm > 2.0) {
    const extraKm = distanceKm - 2.0;
    const additionalFee = Math.round(extraKm * 150);
    estimatedDeliveryFee = Math.round((baseDeliveryFee + additionalFee) / 50) * 50;
  }

  const inDeliveryRadius = distanceKm <= 35.0;

  return {
    distanceKm,
    distanceText,
    durationMinutes,
    durationText,
    estimatedDeliveryFee,
    inDeliveryRadius,
    userLocation,
    restaurantLocation,
    isLiveGoogleMaps: isLive,
    routingEngine
  };
}

/**
 * Batch calculation for multiple restaurants in parallel with shared user origin geocoding.
 */
export async function calculateBatchRestaurantDistanceMetrics(
  restaurants: any[],
  userAddressOrCoords: string | { lat: number; lng: number }
): Promise<any[]> {
  if (!restaurants || restaurants.length === 0) return [];

  let userLocation: GeoLocation;
  if (typeof userAddressOrCoords === 'string') {
    const geo = await geocodeAddress(userAddressOrCoords);
    userLocation = { lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress };
  } else {
    userLocation = {
      lat: userAddressOrCoords.lat,
      lng: userAddressOrCoords.lng
    };
  }

  return Promise.all(
    restaurants.map(async (rest) => {
      try {
        const metrics = await calculateRestaurantDistanceMetrics(rest, userLocation);
        return {
          ...rest,
          distanceKm: metrics.distanceKm,
          distanceText: metrics.distanceText,
          durationMinutes: metrics.durationMinutes,
          durationText: metrics.durationText,
          calculatedDeliveryFee: metrics.estimatedDeliveryFee,
          inDeliveryRadius: metrics.inDeliveryRadius,
          isLiveRoadDistance: metrics.isLiveGoogleMaps,
          routingEngine: metrics.routingEngine
        };
      } catch (e) {
        return rest;
      }
    })
  );
}
