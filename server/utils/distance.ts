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
  isLiveRoadDistance: boolean;
  routingEngine?: 'OSRM' | 'OpenStreetMap Routing' | 'Valhalla';
  points?: { lat: number; lng: number }[];
}

// Live Courier Telemetry Store
export interface CourierTelemetry {
  courierId: string;
  orderId?: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt: string;
}

const courierTelemetryMap = new Map<string, CourierTelemetry>();

export function recordCourierLocation(data: CourierTelemetry) {
  courierTelemetryMap.set(data.courierId, data);
  if (data.orderId) {
    courierTelemetryMap.set(`order:${data.orderId}`, data);
  }
}

export function getCourierLocationForOrder(orderId: string, courierId?: string): CourierTelemetry | null {
  if (orderId && courierTelemetryMap.has(`order:${orderId}`)) {
    return courierTelemetryMap.get(`order:${orderId}`)!;
  }
  if (courierId && courierTelemetryMap.has(courierId)) {
    return courierTelemetryMap.get(courierId)!;
  }
  return null;
}

/**
 * Decodes Google encoded polyline string into array of GPS coordinates.
 */
export function decodePolyline(str: string, precision: number = 5): { lat: number; lng: number }[] {
  let index = 0, lat = 0, lng = 0;
  const coordinates: { lat: number; lng: number }[] = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    coordinates.push({
      lat: Math.round((lat / Math.pow(10, precision)) * 1e6) / 1e6,
      lng: Math.round((lng / Math.pow(10, precision)) * 1e6) / 1e6
    });
  }
  return coordinates;
}

/**
 * Straight-line distance only. Never treat this value as road distance or a delivery quote.
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
    return Math.round(straightLineKm * 10) / 10;
  } catch {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }
}

/**
 * Geocodes an address to live latitude & longitude using a 4-tier failover chain:
 * Tier 1: Photon (OpenStreetMap)
 * Tier 2: Nominatim (OpenStreetMap)
 */
export async function geocodeAddress(addressStr: string): Promise<GeoLocation & { isLive: boolean; provider?: string }> {
  const cleanAddr = (addressStr || '').trim().replace(/\\s+/g, ' ');
  if (!cleanAddr) {
    throw new Error('Enter a delivery address or use the current-location button.');
  }

  // Parse Plus Codes (Open Location Codes, e.g. "56MJ+55C, Oda" or "6FP52X3X+Q9")
  const plusMatch = cleanAddr.match(/^([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4})[,\s]*(.*)$/i);
  const plusLocality = plusMatch ? plusMatch[2].trim() : '';

  // A street name alone can match places in several countries. Restrict searches to
  // Nigeria, try the customer's literal address first, then a Nigeria-qualified query, and plus locality if present.
  const rawQueries = [cleanAddr, `${cleanAddr}, Nigeria`];
  if (plusLocality) {
    rawQueries.push(`${plusLocality}, Nigeria`);
    rawQueries.push(plusLocality);
  }
  const queries = [...new Set(rawQueries)];
  const isValidPoint = (lat: unknown, lng: unknown) => {
    const y = Number(lat);
    const x = Number(lng);
    return Number.isFinite(y) && Number.isFinite(x) &&
      y >= 4 && y <= 14 && x >= 2 && x <= 15;
  };

  // Tier 1: Photon (OpenStreetMap).
  const photonBase = (CONFIG.PHOTON_BASE_URL || 'https://photon.komoot.io').replace(/\/+$/, '').replace(/\/api$/, '');
  for (const query of queries) {
    try {
      const params = new URLSearchParams({ q: query, limit: '5', lang: 'en', countrycode: 'ng' });
      const photonUrl = `${photonBase}/api/?${params.toString()}`;
      const response = await fetch(photonUrl, {
        headers: { 'User-Agent': 'VeyraNG-FoodDelivery/2.1 (delivery address geocoding)' },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        if (response.status === 429) console.warn('[Geocoding] Photon rate limit encountered (429)');
        continue;
      }
      const data = await response.json();
      const features = Array.isArray(data?.features) ? data.features : [];
      for (const feature of features) {
        const [lng, lat] = feature?.geometry?.coordinates || [];
        if (!isValidPoint(lat, lng)) continue;
        const props = feature.properties || {};
        if (props.country && !/nigeria/i.test(String(props.country))) continue;
        const label = [
          [props.housenumber, props.street || props.name].filter(Boolean).join(' '),
          props.district || props.suburb,
          props.city || props.county,
          props.state,
          props.country || 'Nigeria'
        ].filter(Boolean).join(', ');
        return {
          lat: Number(lat),
          lng: Number(lng),
          formattedAddress: label || props.name || cleanAddr,
          isLive: true,
          provider: 'Photon (OpenStreetMap)'
        };
      }
    } catch (error: any) {
      console.warn('[Geocoding] Photon attempt note:', error?.message || String(error));
    }
  }

  // Tier 3: Nominatim (OpenStreetMap). One-off server-side lookup.
  const nominatimBase = (CONFIG.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/+$/, '');
  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        countrycodes: 'ng',
        addressdetails: '1',
        limit: '5'
      });
      const response = await fetch(`${nominatimBase}/search?${params.toString()}`, {
        headers: { 'User-Agent': 'VeyraNG-FoodDelivery/2.1 (delivery address geocoding)' },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) {
        if (response.status === 429) console.warn('[Geocoding] Nominatim rate limit encountered (429)');
        continue;
      }
      const results = await response.json();
      if (!Array.isArray(results)) continue;
      const match = results.find((item: any) =>
        /nigeria/i.test(String(item?.address?.country || '')) &&
        isValidPoint(item?.lat, item?.lon)
      );
      if (!match) continue;
      return {
        lat: Number(match.lat),
        lng: Number(match.lon),
        formattedAddress: match.display_name || cleanAddr,
        isLive: true,
        provider: 'OpenStreetMap Nominatim'
      };
    } catch (error: any) {
      console.warn('[Geocoding] Nominatim attempt note:', error?.message || String(error));
    }
  }

  throw new Error('We could not locate this address in Nigeria. Choose one of the address suggestions or use the current-location button, then retry.');
}

/**
 * Calculates driving distance, router-estimated duration, and returned road geometry.
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
  routingEngine: 'OSRM' | 'OpenStreetMap Routing' | 'Valhalla';
  points: { lat: number; lng: number }[];
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

  // Tier 1: OSRM Road Routing API (Open Source, full road geometry)
  try {
    const osrmBase = (CONFIG.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/+$/, '');
    const osrmUrl = `${osrmBase}/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(3000) });
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.round(route.duration / 60);
        const rawCoords = route.geometry?.coordinates || [];
        const points = rawCoords.map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }));
        if (distanceKm <= 0 || durationMinutes <= 0 || points.length < 2) throw new Error('OSRM returned an incomplete route geometry.');

        return {
          distanceKm,
          distanceText: `${distanceKm} km`,
          durationMinutes,
          durationText: `${durationMinutes} min`,
          isLive: true,
          routingEngine: 'OSRM',
          points,
          originGeo,
          destGeo
        };
      }
    } else if (osrmRes.status === 429) {
      console.warn('[Routing] OSRM rate limit encountered (429) - falling back to next provider');
    }
  } catch (err: any) {
    console.log('OSRM live routing fallback note:', err?.message || String(err));
  }

  // Tier 3: Valhalla Routing Engine (Open Source, Hosted or Self-Hosted)
  const valhallaBase = (CONFIG.VALHALLA_BASE_URL || 'https://valhalla.openstreetmap.de').replace(/\/+$/, '').replace(/\/route$/, '');
  try {
    const valhallaUrl = `${valhallaBase}/route`;
    const vPayload = {
      locations: [
        { lat: originGeo.lat, lon: originGeo.lng },
        { lat: destGeo.lat, lon: destGeo.lng }
      ],
      costing: 'auto',
      units: 'kilometers',
      directions_options: { units: 'kilometers' }
    };
    const vResp = await fetch(valhallaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VeyraNG-FoodDelivery/2.1'
      },
      body: JSON.stringify(vPayload),
      signal: AbortSignal.timeout(3500)
    });
    if (vResp.ok) {
      const vData = await vResp.json();
      const summary = vData.trip?.summary;
      if (summary && Number.isFinite(summary.length) && Number.isFinite(summary.time)) {
        const distanceKm = Math.round(summary.length * 10) / 10;
        const durationMinutes = Math.round(summary.time / 60);
        let points: { lat: number; lng: number }[] = [];
        const legs = vData.trip?.legs;
        if (Array.isArray(legs) && legs[0]?.shape) {
          try { points = decodePolyline(legs[0].shape, 6); } catch { points = []; }
        }
        if (distanceKm <= 0 || durationMinutes <= 0 || points.length < 2) throw new Error('Valhalla returned an incomplete route geometry.');
        return {
          distanceKm,
          distanceText: `${distanceKm} km`,
          durationMinutes,
          durationText: `${durationMinutes} min`,
          isLive: true,
          routingEngine: 'Valhalla',
          points,
          originGeo,
          destGeo
        };
      }
    } else if (vResp.status === 429) {
      console.warn('[Routing] Valhalla rate limit encountered (429) - falling back to next provider');
    }
  } catch (error: any) {
    console.warn('[Routing] Valhalla router note:', error?.message || String(error));
  }

  // Secondary public OSRM-compatible routing endpoint.
  try {
    const osmRouteUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${originGeo.lng},${originGeo.lat};${destGeo.lng},${destGeo.lat}?overview=full&geometries=geojson`;
    const osmRes = await fetch(osmRouteUrl, {
      headers: { 'User-Agent': 'VeyraNG-FoodDelivery/2.1' },
      signal: AbortSignal.timeout(2500)
    });
    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData.code === 'Ok' && osmData.routes && osmData.routes.length > 0) {
        const route = osmData.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const durationMinutes = Math.round(route.duration / 60);
        const points = (route.geometry?.coordinates || []).map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }));
        if (distanceKm > 0 && durationMinutes > 0 && points.length >= 2) {
          return { distanceKm, distanceText: `${distanceKm} km`, durationMinutes, durationText: `${durationMinutes} min`, isLive: true, routingEngine: 'OpenStreetMap Routing', points, originGeo, destGeo };
        }
      }
    }
  } catch (err: any) {
    console.warn('[Routing] OSM Routing fallback note:', err?.message || String(err));
  }

  throw new Error('No free road-routing provider is available right now. Please retry shortly; no estimated route or delivery fee was generated.');

}

/**
 * Calculates live distance metrics and dynamic delivery fee between customer address and restaurant.
 */
export async function calculateRestaurantDistanceMetrics(
  restaurant: any,
  userAddressOrCoords: string | { lat: number; lng: number }
): Promise<DistanceCalculationResult> {
  const restaurantLat = Number(restaurant.lat ?? restaurant.latitude);
  const restaurantLng = Number(restaurant.lng ?? restaurant.longitude);
  if (!Number.isFinite(restaurantLat) || !Number.isFinite(restaurantLng) || restaurantLat < -90 || restaurantLat > 90 || restaurantLng < -180 || restaurantLng > 180) {
    throw new Error('Restaurant location coordinates are missing or invalid in D1');
  }
  const restaurantLocation: GeoLocation = {
    lat: restaurantLat,
    lng: restaurantLng,
    formattedAddress: restaurant.address || restaurant.formattedAddress || undefined
  };

  let userLocation: GeoLocation;
  if (typeof userAddressOrCoords === 'string') {
    const geo = await geocodeAddress(userAddressOrCoords);
    userLocation = { lat: geo.lat, lng: geo.lng, formattedAddress: geo.formattedAddress };
  } else {
    const lat = Number(userAddressOrCoords.lat);
    const lng = Number(userAddressOrCoords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Customer location coordinates are missing or invalid.');
    userLocation = { lat, lng };
  }

  const { distanceKm, distanceText, durationMinutes, durationText, isLive, routingEngine } =
    await calculateDistanceAndDuration(userLocation, restaurantLocation);

  // Resolve configured delivery-zone pricing from D1. Never invent a base fee,
  // per-kilometre price, radius, or surge multiplier in application code.
  let matchedZone: any = null;
  const zoneRef = String(restaurant.zoneId ?? restaurant.deliveryZoneId ?? restaurant.zone ?? restaurant.delivery_zone ?? '').trim();
  try {
    const { d1Client } = await import('../db/d1Client.ts');
    if (zoneRef) {
      const zoneResult = await d1Client.query(
        'SELECT * FROM delivery_zones WHERE is_active = 1 AND (id = ? OR code = ? OR name = ?) LIMIT 1',
        [zoneRef, zoneRef.toUpperCase(), zoneRef]
      );
      matchedZone = zoneResult.results?.[0] ?? null;
    }
    // If a restaurant has no explicit zone assignment, use a city match only when exactly one active zone exists there.
    if (!matchedZone && !zoneRef && String(restaurant.city || '').trim()) {
      const cityZones = await d1Client.query(
        'SELECT * FROM delivery_zones WHERE is_active = 1 AND city = ?',
        [String(restaurant.city).trim()]
      );
      if (cityZones.results?.length === 1) matchedZone = cityZones.results[0];
    }
  } catch (error) {
    console.warn('[Restaurant Distance] Configured zone lookup failed:', error instanceof Error ? error.message : String(error));
  }

  let configuredRadius = Number(matchedZone?.radius_km ?? matchedZone?.max_radius_km ?? restaurant.deliveryRadiusKm ?? restaurant.delivery_radius_km);
  let estimatedDeliveryFee: number;
  if (matchedZone) {
    const baseFee = Number(matchedZone.base_delivery_fee ?? matchedZone.base_fee);
    const perKmFee = Number(matchedZone.per_km_fee ?? matchedZone.perKmFee);
    const surge = Number(matchedZone.surge_multiplier ?? matchedZone.surgeMultiplier);
    if (!Number.isFinite(baseFee) || baseFee < 0 || !Number.isFinite(perKmFee) || perKmFee < 0 || !Number.isFinite(surge) || surge < 0) {
      throw new Error('The active delivery zone has incomplete or invalid pricing configuration.');
    }
    estimatedDeliveryFee = Math.round((baseFee + distanceKm * perKmFee) * surge * 100) / 100;
  } else {
    const configuredRestaurantFee = Number(restaurant.deliveryFee ?? restaurant.delivery_fee);
    if (!Number.isFinite(configuredRestaurantFee) || configuredRestaurantFee < 0) {
      throw new Error('Restaurant delivery fee or active delivery-zone pricing is not configured in D1.');
    }
    estimatedDeliveryFee = configuredRestaurantFee;
  }
  if (!Number.isFinite(configuredRadius) || configuredRadius <= 0) {
    throw new Error('Delivery radius is not configured for this restaurant or its active delivery zone.');
  }
  const inDeliveryRadius = distanceKm <= configuredRadius;

  return {
    distanceKm,
    distanceText,
    durationMinutes,
    durationText,
    estimatedDeliveryFee,
    inDeliveryRadius,
    userLocation,
    restaurantLocation,
    isLiveRoadDistance: isLive,
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
    const lat = Number(userAddressOrCoords.lat);
    const lng = Number(userAddressOrCoords.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Customer location coordinates are missing or invalid.');
    userLocation = { lat, lng };
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
          isLiveRoadDistance: metrics.isLiveRoadDistance,
          routingEngine: metrics.routingEngine
        };
      } catch (e) {
        const {
          distanceKm, distanceText, durationMinutes, durationText,
          calculatedDeliveryFee, inDeliveryRadius, isLiveRoadDistance, routingEngine,
          ...restaurantWithoutStaleMetrics
        } = rest;
        return restaurantWithoutStaleMetrics;
      }
    })
  );
}

export interface LiveOrderTrackingResult {
  location: {
    lat: number;
    lng: number;
    heading: number;
    speed: number;
    updatedAt: string;
  };
  signalStatus: 'live' | 'transmitting' | 'searching';
  remainingDistanceKm: number;
  remainingDurationMinutes: number;
  totalDistanceKm: number;
  routeProgress: number; // 0 - 100
  routePoints: { lat: number; lng: number }[];
  kitchenLocation: GeoLocation & { name?: string };
  customerLocation: GeoLocation;
}

/**
 * Dynamically calculates the live courier position, heading, speed, remaining distance,
 * and ETA along the real road path for an active delivery order.
 */
export async function calculateLiveOrderTracking(order: any, restaurantObj?: any): Promise<LiveOrderTrackingResult> {
  const kitchenLat = Number(order.restaurantLat ?? order.restaurantLocation?.lat ?? restaurantObj?.lat);
  const kitchenLng = Number(order.restaurantLng ?? order.restaurantLocation?.lng ?? restaurantObj?.lng);
  if (!Number.isFinite(kitchenLat) || !Number.isFinite(kitchenLng) || kitchenLat < -90 || kitchenLat > 90 || kitchenLng < -180 || kitchenLng > 180) throw new Error('Restaurant coordinates are unavailable; live tracking cannot be generated.');
  const kitchenLocation: GeoLocation & { name?: string } = { lat: kitchenLat, lng: kitchenLng, formattedAddress: order.restaurantAddress || restaurantObj?.address, name: order.restaurantName || restaurantObj?.name };
  let customerLat = Number(order.customerLat ?? order.customerLocation?.lat);
  let customerLng = Number(order.customerLng ?? order.customerLocation?.lng);
  const customerAddress = String(order.customerAddress || '').trim();
  if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng) || customerLat < -90 || customerLat > 90 || customerLng < -180 || customerLng > 180) {
    if (!customerAddress) throw new Error('Customer coordinates or a verified address are required for tracking.');
    const geocoded = await geocodeAddress(customerAddress);
    customerLat = geocoded.lat; customerLng = geocoded.lng;
  }
  const customerLocation: GeoLocation = { lat: customerLat, lng: customerLng, formattedAddress: customerAddress || undefined };
  const realTelemetry = getCourierLocationForOrder(String(order.id || ''), order.courier?.id ? String(order.courier.id) : undefined);
  const isRecentTelemetry = !!realTelemetry && Number.isFinite(Date.parse(realTelemetry.updatedAt)) && (Date.now() - Date.parse(realTelemetry.updatedAt) < 5 * 60 * 1000);
  if (!isRecentTelemetry || !realTelemetry) throw new Error('Live courier GPS is unavailable for this order. Simulated courier positions are disabled.');
  const routeResult = await calculateDistanceAndDuration({ lat: realTelemetry.lat, lng: realTelemetry.lng }, customerLocation);
  const totalRoute = await calculateDistanceAndDuration(kitchenLocation, customerLocation);
  return {
    location: { lat: realTelemetry.lat, lng: realTelemetry.lng, heading: realTelemetry.heading ?? 0, speed: realTelemetry.speed ?? 0, updatedAt: realTelemetry.updatedAt },
    signalStatus: 'live',
    remainingDistanceKm: routeResult.distanceKm,
    remainingDurationMinutes: routeResult.durationMinutes,
    totalDistanceKm: totalRoute.distanceKm,
    routeProgress: Math.max(0, Math.min(100, Math.round((1 - routeResult.distanceKm / Math.max(totalRoute.distanceKm, 0.1)) * 100))),
    routePoints: routeResult.points,
    kitchenLocation,
    customerLocation
  };
}
