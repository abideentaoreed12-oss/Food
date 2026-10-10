import React, { useMemo, useEffect, useState } from 'react';
import { Map, AdvancedMarker, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';
import { Order } from '../../types';
import { useDelivery } from '../../context/DeliveryContext';
import { Store, MapPin, Bike, Navigation, Compass, Radio } from 'lucide-react';

interface OrderRouteMapProps {
  order: Order;
  courierLocation?: { lat: number; lng: number; heading?: number; speed?: number } | null;
  signalStatus?: 'live' | 'paused' | 'searching' | 'transmitting';
  routePoints?: { lat: number; lng: number }[];
  remainingDistanceKm?: number;
  totalDistanceKm?: number;
  kitchenLocation?: { lat: number; lng: number; name?: string; formattedAddress?: string };
  customerLocation?: { lat: number; lng: number; formattedAddress?: string };
  className?: string;
}

// Google Maps Polyline Component for Google Maps mode
const GoogleMapsPolylineRoute: React.FC<{
  path: { lat: number; lng: number }[];
  color?: string;
}> = ({ path, color = '#FF5500' }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google || !window.google.maps || path.length < 2) return;

    const polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map
    });

    try {
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 40);
    } catch {}

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, color]);

  return null;
};

// Accurate Haversine distance calculation
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const OrderRouteMap: React.FC<OrderRouteMapProps> = ({
  order,
  courierLocation,
  signalStatus = 'live',
  routePoints: propRoutePoints,
  remainingDistanceKm: propRemainingKm,
  totalDistanceKm: propTotalKm,
  kitchenLocation: propKitchenLoc,
  customerLocation: propCustomerLoc,
  className = ''
}) => {
  const { restaurants } = useDelivery();
  const apiIsLoaded = useApiIsLoaded();

  const [geocodedCustomer, setGeocodedCustomer] = useState<{ lat: number; lng: number } | null>(null);

  // 1. Resolve Kitchen Origin Coordinates Dynamically
  const kitchenCoord = useMemo(() => {
    if (propKitchenLoc && Number.isFinite(propKitchenLoc.lat) && Number.isFinite(propKitchenLoc.lng)) {
      return {
        lat: propKitchenLoc.lat,
        lng: propKitchenLoc.lng,
        name: propKitchenLoc.name || order.restaurantName || 'Kitchen Hub',
        address: propKitchenLoc.formattedAddress || order.restaurantAddress || 'Kitchen Address'
      };
    }
    const matchingRest = (restaurants || []).find((r) => r.id === order.restaurantId);
    if (matchingRest && Number.isFinite(matchingRest.lat) && Number.isFinite(matchingRest.lng)) {
      return {
        lat: matchingRest.lat,
        lng: matchingRest.lng,
        name: matchingRest.name,
        address: matchingRest.address
      };
    }
    if (Number.isFinite(order.restaurantLat) && Number.isFinite(order.restaurantLng)) {
      return {
        lat: order.restaurantLat!,
        lng: order.restaurantLng!,
        name: order.restaurantName || 'Kitchen Hub',
        address: order.restaurantAddress || 'Kitchen Address'
      };
    }
    // Do not invent a restaurant location when stored coordinates are missing.
    return {
      lat: Number.NaN,
      lng: Number.NaN,
      name: order.restaurantName || 'Kitchen Hub',
      address: order.restaurantAddress || ''
    };
  }, [propKitchenLoc, order.restaurantId, order.restaurantLat, order.restaurantLng, order.restaurantName, order.restaurantAddress, restaurants]);

  // Dynamic client-side geocoding for customer address if no coordinates stored
  useEffect(() => {
    if (propCustomerLoc?.lat || (Number.isFinite(order.customerLat) && Number.isFinite(order.customerLng))) {
      return;
    }
    const addr = order.customerAddress?.trim();
    if (!addr) return;

    let isMounted = true;
    fetch(`/api/geocode?address=${encodeURIComponent(addr)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.data && Number.isFinite(data.data.lat) && Number.isFinite(data.data.lng)) {
          setGeocodedCustomer({ lat: data.data.lat, lng: data.data.lng });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [order.customerAddress, order.customerLat, order.customerLng, propCustomerLoc]);

  // 2. Resolve Customer Delivery Destination Coordinates Dynamically
  const customerCoord = useMemo(() => {
    if (propCustomerLoc && Number.isFinite(propCustomerLoc.lat) && Number.isFinite(propCustomerLoc.lng)) {
      return {
        lat: propCustomerLoc.lat,
        lng: propCustomerLoc.lng,
        address: propCustomerLoc.formattedAddress || order.customerAddress || 'Delivery Address'
      };
    }
    if (Number.isFinite(order.customerLat) && Number.isFinite(order.customerLng)) {
      return {
        lat: order.customerLat!,
        lng: order.customerLng!,
        address: order.customerAddress || 'Delivery Address'
      };
    }
    if (geocodedCustomer) {
      return {
        lat: geocodedCustomer.lat,
        lng: geocodedCustomer.lng,
        address: order.customerAddress || 'Delivery Address'
      };
    }
    // Never substitute fabricated coordinates when address geocoding fails.
    return {
      lat: Number.NaN,
      lng: Number.NaN,
      address: order.customerAddress || 'Delivery Address'
    };
  }, [propCustomerLoc, order.customerLat, order.customerLng, order.customerAddress, geocodedCustomer, kitchenCoord]);

  // 3. Compute Progress Ratio
  const progressRatio = useMemo(() => {
    if (order.status === 'delivered') return 1;
    if (order.status === 'placed') return 0.05;
    if (order.status === 'confirmed') return 0.15;
    if (order.status === 'preparing') return 0.25;
    if (order.status === 'ready_for_pickup') return 0.35;
    if (order.status === 'in_transit') {
      const p = order.routeProgress != null ? order.routeProgress : 65;
      return Math.max(0.4, Math.min(0.96, p / 100));
    }
    return 0;
  }, [order.status, order.routeProgress]);

  // 4. Generate or Use Real Road Waypoints for Route
  const routeWaypoints = useMemo(() => {
    if (propRoutePoints && propRoutePoints.length >= 2) {
      return propRoutePoints;
    }
    // Without a routing-provider response, use only known endpoints, not a fabricated road.
    if (![kitchenCoord.lat, kitchenCoord.lng, customerCoord.lat, customerCoord.lng].every(Number.isFinite)) return [];
    return [kitchenCoord, customerCoord].map(({ lat, lng }) => ({ lat, lng }));
  }, [propRoutePoints, kitchenCoord, customerCoord]);

  // 5. Use only a verified live courier fix. Never synthesize movement from order progress.
  const courierCoord = useMemo(() => {
    if (courierLocation && Number.isFinite(courierLocation.lat) && Number.isFinite(courierLocation.lng)) {
      return courierLocation;
    }
    return { lat: Number.NaN, lng: Number.NaN, speed: 0, heading: 0 };
  }, [courierLocation]);

  // Trip and remaining distances
  const totalTripKm = useMemo(() => {
    if (Number.isFinite(propTotalKm)) return propTotalKm as number;
    if (![kitchenCoord.lat, kitchenCoord.lng, customerCoord.lat, customerCoord.lng].every(Number.isFinite)) {
      return Number.NaN;
    }
    return calculateDistanceKm(kitchenCoord.lat, kitchenCoord.lng, customerCoord.lat, customerCoord.lng);
  }, [propTotalKm, kitchenCoord, customerCoord]);

  const remainingDistanceKm = useMemo(() => {
    if (order.status === 'delivered') return 0;
    if (Number.isFinite(propRemainingKm)) return propRemainingKm as number;
    if (![courierCoord.lat, courierCoord.lng, customerCoord.lat, customerCoord.lng].every(Number.isFinite)) {
      return Number.NaN;
    }
    return calculateDistanceKm(courierCoord.lat, courierCoord.lng, customerCoord.lat, customerCoord.lng);
  }, [order.status, propRemainingKm, courierCoord, customerCoord]);

  const centerCoord = useMemo(() => {
    return {
      lat: (kitchenCoord.lat + customerCoord.lat) / 2,
      lng: (kitchenCoord.lng + customerCoord.lng) / 2
    };
  }, [kitchenCoord, customerCoord]);

  // True Geographic Bounding-Box Coordinate Projection for the SVG Vector Map
  const svgMapPoints = useMemo(() => {
    const allPoints = [...routeWaypoints, courierCoord, kitchenCoord, customerCoord];
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    for (const p of allPoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const padX = 70;
    const padY = 55;
    const w = 600 - padX * 2;
    const h = 240 - padY * 2;

    const latSpan = Math.max(0.004, maxLat - minLat);
    const lngSpan = Math.max(0.004, maxLng - minLng);

    const project = (pt: { lat: number; lng: number }) => ({
      x: Math.round(padX + ((pt.lng - minLng) / lngSpan) * w),
      y: Math.round(padY + ((maxLat - pt.lat) / latSpan) * h)
    });

    const projectedWaypoints = routeWaypoints.map(project);
    const pOrigin = project(kitchenCoord);
    const pDest = project(customerCoord);
    const pRider = project(courierCoord);

    // Build SVG Path
    let pathD = `M ${projectedWaypoints[0]?.x || pOrigin.x} ${projectedWaypoints[0]?.y || pOrigin.y}`;
    for (let i = 1; i < projectedWaypoints.length; i++) {
      const prev = projectedWaypoints[i - 1];
      const curr = projectedWaypoints[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      pathD += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
    }
    const last = projectedWaypoints[projectedWaypoints.length - 1] || pDest;
    pathD += ` L ${last.x} ${last.y}`;

    return {
      pathD,
      riderX: pRider.x,
      riderY: pRider.y
    };
  }, [routeWaypoints, courierCoord, kitchenCoord, customerCoord]);

  if (![kitchenCoord.lat, kitchenCoord.lng, customerCoord.lat, customerCoord.lng, courierCoord.lat, courierCoord.lng].every(Number.isFinite)) {
    return (
      <div className={`w-full rounded-2xl border border-slate-200 bg-white p-5 text-slate-700 ${className}`}>
        <p className="font-semibold">Live map location unavailable</p>
        <p className="mt-1 text-sm text-slate-500">Verified restaurant and delivery coordinates are required to draw this route. The map will update when valid locations are available.</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-900 text-white ${className}`}>
      {/* Route Header Telemetry Bar */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              signalStatus === 'live' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
            }`}
          />
          <span className="font-bold text-white flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dynamic Live Route GPS</span>
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-orange-400 font-mono font-semibold">
            {order.status === 'delivered' ? 'Destination Reached' : `${remainingDistanceKm} km away`}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300">
          <span className="flex items-center gap-1">
            <span className="text-slate-400">Total:</span> {totalTripKm} km
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1">
            <span className="text-slate-400">Progress:</span> {Math.round(progressRatio * 100)}%
          </span>
        </div>
      </div>

      {/* Map Body: Google Maps when available, otherwise crisp SVG Radar Vector Route Map */}
      <div className="relative w-full h-[260px] sm:h-[300px] overflow-hidden bg-slate-950">
        {apiIsLoaded ? (
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={centerCoord}
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            {/* 1. Kitchen Marker */}
            <AdvancedMarker position={{ lat: kitchenCoord.lat, lng: kitchenCoord.lng }} title={kitchenCoord.name}>
              <div className="relative group cursor-pointer">
                <div className="px-2.5 py-1 rounded-xl bg-orange-600 text-white border border-white/80 shadow-lg text-[11px] font-bold flex items-center gap-1">
                  <Store className="w-3.5 h-3.5" />
                  <span className="max-w-[100px] truncate">{kitchenCoord.name}</span>
                </div>
                <div className="w-2 h-2 mx-auto -mt-1 rotate-45 bg-orange-600 border-r border-b border-white/80" />
              </div>
            </AdvancedMarker>

            {/* 2. Customer Destination Marker */}
            <AdvancedMarker position={{ lat: customerCoord.lat, lng: customerCoord.lng }} title="Your Address">
              <div className="relative group cursor-pointer">
                <div className="px-2.5 py-1 rounded-xl bg-rose-600 text-white border border-white/80 shadow-lg text-[11px] font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Destination</span>
                </div>
                <div className="w-2 h-2 mx-auto -mt-1 rotate-45 bg-rose-600 border-r border-b border-white/80" />
              </div>
            </AdvancedMarker>

            {/* 3. Live Courier Moving Marker */}
            <AdvancedMarker position={{ lat: courierCoord.lat, lng: courierCoord.lng }} title="Rider in Transit">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-emerald-400/30 animate-pulse">
                  <Bike className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                </div>
              </div>
            </AdvancedMarker>

            {/* 4. Real Route Polyline */}
            <GoogleMapsPolylineRoute path={routeWaypoints} color="#FF5500" />
          </Map>
        ) : (
          /* SVG Dynamic Vector Route Telemetry Map (Fallback & Live Vector) */
          <div className="w-full h-full relative flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 overflow-hidden">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#FF5500_1px,transparent_1px)] [background-size:20px_20px]" />

            {/* SVG Connecting Dynamic Route Vector */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 600 240"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#EA580C" />
                  <stop offset="50%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#F43F5E" />
                </linearGradient>
              </defs>
              {/* Road line background */}
              <path
                d={svgMapPoints.pathD}
                fill="none"
                stroke="#1E293B"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d={svgMapPoints.pathD}
                fill="none"
                stroke="#334155"
                strokeWidth="4"
                strokeLinecap="round"
              />
              {/* Dynamic active route path */}
              <path
                d={svgMapPoints.pathD}
                fill="none"
                stroke="url(#routeGradient)"
                strokeWidth="4"
                strokeDasharray="8 6"
                strokeLinecap="round"
                className="animate-pulse"
              />
            </svg>

            {/* Dynamic Moving Courier Rider on the Vector Road */}
            <div
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700 ease-out"
              style={{
                left: `${(svgMapPoints.riderX / 600) * 100}%`,
                top: `${(svgMapPoints.riderY / 240) * 100}%`
              }}
            >
              <div className="relative group flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-emerald-400/40 animate-pulse">
                  <Bike className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                </div>
                {/* Rider pill floating label */}
                <div className="mt-1 bg-slate-900/95 backdrop-blur-md px-2.5 py-0.5 rounded-lg border border-emerald-500/50 text-[10px] font-bold text-white whitespace-nowrap shadow-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{order.courier?.name || 'Rider'} · {Math.round(progressRatio * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Interactive Visual Waypoint Cards on Vector Map */}
            <div className="relative z-10 flex items-start justify-between">
              {/* Kitchen Origin */}
              <div className="bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-orange-500/30 text-xs shadow-md max-w-[170px]">
                <div className="flex items-center gap-1.5 text-orange-400 font-bold uppercase text-[10px]">
                  <Store className="w-3.5 h-3.5" />
                  <span>Kitchen Origin</span>
                </div>
                <div className="font-bold text-white truncate mt-0.5">{kitchenCoord.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{kitchenCoord.address}</div>
              </div>

              {/* Live Distance & ETA Center Telemetry */}
              <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/40 text-center shadow-lg">
                <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-extrabold text-[11px]">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Live Dispatch Vector</span>
                </div>
                <div className="text-base font-extrabold font-mono text-white mt-0.5">
                  {order.status === 'delivered' ? 'Destination Reached' : `${remainingDistanceKm} km remaining`}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Speed: {order.status === 'in_transit' ? `${courierCoord.speed || 28} km/h` : '0 km/h'} · Active GPS
                </div>
              </div>

              {/* Customer Destination */}
              <div className="bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-rose-500/30 text-xs shadow-md max-w-[170px] text-right">
                <div className="flex items-center justify-end gap-1.5 text-rose-400 font-bold uppercase text-[10px]">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Destination</span>
                </div>
                <div className="font-bold text-white truncate mt-0.5">{order.customerName || 'Customer'}</div>
                <div className="text-[10px] text-slate-400 truncate">{order.customerAddress}</div>
              </div>
            </div>

            {/* Bottom Turn-by-Turn GPS Callout */}
            <div className="relative z-10 bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs mt-auto">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-orange-400 shrink-0 rotate-45" />
                <span className="text-slate-300 truncate">
                  {order.status === 'delivered'
                    ? 'Meal safely delivered and verified via 4-digit PIN.'
                    : order.status === 'in_transit'
                    ? `En route along primary corridor toward ${order.customerAddress}.`
                    : `Order being prepared at ${kitchenCoord.name}. Dispatch courier assigned.`}
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold shrink-0">
                {order.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Location Coordinates Callout */}
      <div className="px-3.5 py-2 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-1 font-mono">
          <Compass className="w-3.5 h-3.5 text-orange-400" />
          <span>Origin: {kitchenCoord.lat.toFixed(4)}, {kitchenCoord.lng.toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-1 font-mono">
          <MapPin className="w-3.5 h-3.5 text-rose-400" />
          <span>Dest: {customerCoord.lat.toFixed(4)}, {customerCoord.lng.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
};

