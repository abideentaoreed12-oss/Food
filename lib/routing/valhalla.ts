import { CONFIG } from '../../server/config';

export interface ValhallaRouteParams {
  locations: { lat: number; lon: number }[];
  costing: 'auto' | 'bicycle' | 'pedestrian';
}

/** Calls the public Valhalla demo service; no paid key or self-hosted server is required. */
export async function getValhallaRoute(params: ValhallaRouteParams) {
  const base = (CONFIG.VALHALLA_BASE_URL || 'https://valhalla.openstreetmap.de').replace(/\/+$/, '').replace(/\/route$/, '');
  const response = await fetch(`${base}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'veyrang-food-delivery' },
    body: JSON.stringify({
      locations: params.locations.map(loc => ({ lat: loc.lat, lon: loc.lon })),
      costing: params.costing,
      units: 'kilometers',
      directions_options: { units: 'kilometers' }
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error(`Valhalla public routing unavailable: HTTP ${response.status}`);
  return response.json();
}
