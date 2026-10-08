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
  routingEngine?: 'Google Maps' | 'OSRM' | 'OpenRouteService' | 'Haversine';
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

  const apiKey = CONFIG.GOOGLE_MAPS_API_KEY;

  // Tier 1: Live Google Maps Geocoding API (if Key is valid and not circuit-broken)
  if (apiKey && isGoogleMapsQuotaAvailable()) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        cleanAddr
      )}&key=${apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          return {
            lat: loc.lat,
            lng: loc.lng,
            formattedAddress: data.results[0].formatted_address || cleanAddr,
            isLive: true,
            provider: 'Google Maps'
          };
        } else if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'RESOURCE_EXHAUSTED' || data.status === 'REQUEST_DENIED') {
          markGoogleMapsQuotaExceeded(data.status);
        }
      }
    } catch (err: any) {
      console.log('Google Maps Geocoding failover trigger:', err?.message || String(err));
    }
  }

  // Tier 2: OpenStreetMap Nominatim Geocoder
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
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
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cleanAddr)}&limit=1`;
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

  // Tier 4: Base fallback
  throw new Error('Could not geocode the supplied address with available live providers');
}

/**
 * Calculates live driving road distance & traffic duration using a 4-tier failover chain:
 * 1. Google Maps Distance Matrix API (Primary)
 * 2. OSRM Road Routing API (Secondary Open Source)
 * 3. OpenRouteService / OSM Public Routing (Tertiary Open Source)
 * 4. Dynamic Road Factor Haversine (Guaranteed Base Safety Fallback)
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
  routingEngine: 'Google Maps' | 'OSRM' | 'OpenRouteService' | 'Haversine';
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

  const apiKey = CONFIG.GOOGLE_MAPS_API_KEY;

  // Tier 1: Primary - Live Google Maps Distance Matrix API (with circuit breaker check)
  if (apiKey && isGoogleMapsQuotaAvailable()) {
    try {
      const originsParam = `${originGeo.lat},${originGeo.lng}`;
      const destParam = `${destGeo.lat},${destGeo.lng}`;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsParam}&destinations=${destParam}&mode=driving&departure_time=now&key=${apiKey}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'OK' && json.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = json.rows[0].elements[0];
          const distanceMeters = element.distance.value;
          const durationSeconds = element.duration_in_traffic?.value || element.duration.value;

          const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
          const durationMinutes = Math.max(5, Math.round(durationSeconds / 60));

          return {
            distanceKm,
            distanceText: `${distanceKm} km`,
            durationMinutes,
            durationText: `${durationMinutes}–${durationMinutes + 8} min`,
            isLive: true,
            routingEngine: 'Google Maps',
            originGeo,
            destGeo
          };
        } else if (json.status === 'OVER_QUERY_LIMIT' || json.status === 'RESOURCE_EXHAUSTED' || json.status === 'REQUEST_DENIED') {
          markGoogleMapsQuotaExceeded(json.status);
        }
      }
    } catch (e: any) {
      console.log('Google Maps Distance Matrix failover trigger:', e?.message || String(e));
    }
  }

  // Tier 2: Secondary - Live OSRM Road Routing API
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=false`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(2500) });
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(6, Math.round((route.duration / 60) * 1.35));

        return {
          distanceKm: Math.max(0.4, distanceKm),
          distanceText: `${Math.max(0.4, distanceKm)} km`,
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

  // Tier 3: Tertiary - OpenRouteService / OSM Public Routing Engine
  try {
    const orsUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=false`;
    const orsRes = await fetch(orsUrl, { signal: AbortSignal.timeout(2500) });
    if (orsRes.ok) {
      const orsData = await orsRes.json();
      if (orsData.code === 'Ok' && orsData.routes && orsData.routes.length > 0) {
        const route = orsData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(6, Math.round((route.duration / 60) * 1.30));

        return {
          distanceKm: Math.max(0.4, distanceKm),
          distanceText: `${Math.max(0.4, distanceKm)} km`,
          durationMinutes,
          durationText: `${durationMinutes}–${durationMinutes + 8} min`,
          isLive: true,
          routingEngine: 'OpenRouteService',
          originGeo,
          destGeo
        };
      }
    }
  } catch (err: any) {
    console.log('OpenRouteService fallback note:', err?.message || String(err));
  }

  // Tier 4: Dynamic calculated fallback based on real coordinates and urban road factor
  const distanceKm = calculateHaversineDistanceKm(
    originGeo.lat,
    originGeo.lng,
    destGeo.lat,
    destGeo.lng
  );

  const drivingMinutes = Math.round((distanceKm / 24) * 60);
  const durationMinutes = Math.max(12, drivingMinutes + 6);

  return {
    distanceKm: Math.max(0.5, distanceKm),
    distanceText: `${Math.max(0.5, distanceKm)} km`,
    durationMinutes,
    durationText: `${durationMinutes}–${durationMinutes + 8} min`,
    isLive: false,
    routingEngine: 'Haversine',
    originGeo,
    destGeo
  };
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
