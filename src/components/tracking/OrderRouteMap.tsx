import React, { useMemo, useEffect } from 'react';
import { Map, AdvancedMarker, useApiIsLoaded, useMap } from '@vis.gl/react-google-maps';
import { Order } from '../../types';
import { useDelivery } from '../../context/DeliveryContext';
import { Store, MapPin, Bike, Navigation, Compass, Radio, CheckCircle2, ShieldCheck } from 'lucide-react';

interface OrderRouteMapProps {
  order: Order;
  courierLocation?: { lat: number; lng: number; heading?: number; speed?: number } | null;
  signalStatus?: 'live' | 'paused' | 'searching';
  className?: string;
}

// Google Maps Polyline Component for Google Maps mode
const GoogleMapsPolylineRoute: React.FC<{
  path: { lat: number; lng: number }[];
  color?: string;
}> = ({ path, color = '#FF5500' }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || typeof window === 'undefined' || !window.google || !window.google.maps) return;

    const polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 4,
      map
    });

    // Auto-fit map viewport to include all points
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

// Helper: resolve realistic coordinates based on Lagos/Abuja addresses
function resolveAddressCoordinates(addr: string, fallbackLat = 6.4474, fallbackLng = 3.4723): { lat: number; lng: number; hub: string } {
  const lower = (addr || '').toLowerCase();
  if (lower.includes('lekki') || lower.includes('admiralty')) {
    return { lat: 6.4520, lng: 3.4880, hub: 'Lekki Phase 1, Lagos' };
  }
  if (lower.includes('victoria') || lower.includes('vi ') || lower.includes('v.i') || lower.includes('ahmadu')) {
    return { lat: 6.4281, lng: 3.4219, hub: 'Victoria Island, Lagos' };
  }
  if (lower.includes('ikoyi') || lower.includes('bourdillon') || lower.includes('banana')) {
    return { lat: 6.4549, lng: 3.4357, hub: 'Ikoyi, Lagos' };
  }
  if (lower.includes('ikeja') || lower.includes('allen') || lower.includes('gra') || lower.includes('isaac')) {
    return { lat: 6.5866, lng: 3.3578, hub: 'Ikeja GRA, Lagos' };
  }
  if (lower.includes('yaba') || lower.includes('macaulay') || lower.includes('akoka')) {
    return { lat: 6.5059, lng: 3.3781, hub: 'Yaba, Lagos' };
  }
  if (lower.includes('surulere') || lower.includes('adeniran')) {
    return { lat: 6.4975, lng: 3.3572, hub: 'Surulere, Lagos' };
  }
  if (lower.includes('marina') || lower.includes('lagos island') || lower.includes('broad')) {
    return { lat: 6.4531, lng: 3.3958, hub: 'Lagos Island, Lagos' };
  }
  if (lower.includes('abuja') || lower.includes('wuse') || lower.includes('maitama') || lower.includes('garki')) {
    return { lat: 9.0765, lng: 7.4721, hub: 'Wuse 2, Abuja' };
  }
  if (lower.includes('ibadan') || lower.includes('bodija')) {
    return { lat: 7.4225, lng: 3.9056, hub: 'Bodija, Ibadan' };
  }
  // Default offset slightly from origin
  return { lat: fallbackLat + 0.012, lng: fallbackLng + 0.018, hub: 'Metropolitan Delivery Zone' };
}

// Great-circle distance calculation
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
  className = ''
}) => {
  const { restaurants } = useDelivery();
  const apiIsLoaded = useApiIsLoaded();

  // 1. Resolve Kitchen Origin Coordinates
  const kitchenCoord = useMemo(() => {
    const matchingRest = (restaurants || []).find((r) => r.id === order.restaurantId);
    if (matchingRest && typeof matchingRest.lat === 'number' && typeof matchingRest.lng === 'number') {
      return { lat: matchingRest.lat, lng: matchingRest.lng, name: matchingRest.name, address: matchingRest.address };
    }
    const resolved = resolveAddressCoordinates(order.restaurantAddress || order.restaurantName || '');
    return { lat: resolved.lat, lng: resolved.lng, name: order.restaurantName || 'Kitchen Hub', address: order.restaurantAddress || resolved.hub };
  }, [order.restaurantId, order.restaurantAddress, order.restaurantName, restaurants]);

  // 2. Resolve Customer Delivery Destination Coordinates
  const customerCoord = useMemo(() => {
    const resolved = resolveAddressCoordinates(order.customerAddress || '', kitchenCoord.lat, kitchenCoord.lng);
    return { lat: resolved.lat, lng: resolved.lng, address: order.customerAddress || resolved.hub };
  }, [order.customerAddress, kitchenCoord]);

  // 3. Compute Live Courier Position
  // If active telemetry is coming from /api/orders/:id/tracking, use it.
  // Otherwise, interpolate smoothly based on order.routeProgress along the vector.
  const progressRatio = useMemo(() => {
    if (order.status === 'delivered') return 1;
    if (order.status === 'placed') return 0.05;
    if (order.status === 'confirmed') return 0.15;
    if (order.status === 'preparing') return 0.3;
    if (order.status === 'ready_for_pickup') return 0.5;
    if (order.status === 'in_transit') {
      const p = order.routeProgress != null ? order.routeProgress : 65;
      return Math.max(0.5, Math.min(0.95, p / 100));
    }
    return 0;
  }, [order.status, order.routeProgress]);

  const courierCoord = useMemo(() => {
    if (courierLocation && typeof courierLocation.lat === 'number' && typeof courierLocation.lng === 'number') {
      return courierLocation;
    }
    // Interpolated waypoint
    return {
      lat: kitchenCoord.lat + (customerCoord.lat - kitchenCoord.lat) * progressRatio,
      lng: kitchenCoord.lng + (customerCoord.lng - kitchenCoord.lng) * progressRatio,
      speed: order.status === 'in_transit' ? 28 : 0,
      heading: 45
    };
  }, [courierLocation, kitchenCoord, customerCoord, progressRatio, order.status]);

  // Total trip distance and remaining distance
  const totalTripKm = useMemo(() => {
    return calculateDistanceKm(kitchenCoord.lat, kitchenCoord.lng, customerCoord.lat, customerCoord.lng) || 3.5;
  }, [kitchenCoord, customerCoord]);

  const remainingDistanceKm = useMemo(() => {
    if (order.status === 'delivered') return 0;
    const dist = calculateDistanceKm(courierCoord.lat, courierCoord.lng, customerCoord.lat, customerCoord.lng);
    return Math.max(0.2, dist);
  }, [courierCoord, customerCoord, order.status]);

  // Route path waypoints for polyline
  const routeWaypoints = useMemo(() => {
    // Generate curved/intermediate road points between kitchen, courier, and destination
    const midLat1 = kitchenCoord.lat + (courierCoord.lat - kitchenCoord.lat) * 0.5 + 0.002;
    const midLng1 = kitchenCoord.lng + (courierCoord.lng - kitchenCoord.lng) * 0.5 - 0.001;

    const midLat2 = courierCoord.lat + (customerCoord.lat - courierCoord.lat) * 0.5 - 0.002;
    const midLng2 = courierCoord.lng + (customerCoord.lng - courierCoord.lng) * 0.5 + 0.001;

    return [
      { lat: kitchenCoord.lat, lng: kitchenCoord.lng },
      { lat: midLat1, lng: midLng1 },
      { lat: courierCoord.lat, lng: courierCoord.lng },
      { lat: midLat2, lng: midLng2 },
      { lat: customerCoord.lat, lng: customerCoord.lng }
    ];
  }, [kitchenCoord, courierCoord, customerCoord]);

  const centerCoord = useMemo(() => {
    return {
      lat: (kitchenCoord.lat + customerCoord.lat) / 2,
      lng: (kitchenCoord.lng + customerCoord.lng) / 2
    };
  }, [kitchenCoord, customerCoord]);

  // Dynamic 2D projection for the interactive vector route map
  const svgMapPoints = useMemo(() => {
    const p0 = { x: 70, y: 75 }; // Kitchen Origin
    const p1 = { x: 230, y: 175 }; // Control 1
    const p2 = { x: 370, y: 65 }; // Control 2
    const p3 = { x: 530, y: 165 }; // Customer Destination

    const t = Math.max(0, Math.min(1, progressRatio));
    // Cubic bezier calculation
    const mt = 1 - t;
    const riderX = mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x;
    const riderY = mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y;

    const pathD = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

    return { p0, p1, p2, p3, riderX, riderY, pathD, t };
  }, [progressRatio]);

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
                  Speed: {order.status === 'in_transit' ? '28 km/h' : '0 km/h'} · Active GPS
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
