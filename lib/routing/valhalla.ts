import { CONFIG } from '../../server/config';

// Service to interface with hosted or self-hosted Valhalla routing API
export interface ValhallaRouteParams {
  locations: { lat: number; lon: number }[];
  costing: 'auto' | 'bicycle' | 'pedestrian';
}

export async function getValhallaRoute(params: ValhallaRouteParams) {
  const rawBase = CONFIG.VALHALLA_BASE_URL || process.env.VALHALLA_BASE_URL || process.env.VALHALLA_URL || 'https://valhalla.openstreetmap.de';
  const cleanBase = rawBase.replace(/\/+$/, '').replace(/\/route$/, '');
  const apiKey = (CONFIG.VALHALLA_API_KEY || process.env.VALHALLA_API_KEY || '').trim();
  const endpoint = `${cleanBase}/route${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`;

  const query = {
    locations: params.locations.map((loc) => ({ lat: loc.lat, lon: loc.lon })),
    costing: params.costing,
    units: 'kilometers',
    directions_options: { units: 'kilometers' }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VeyraNG-FoodDelivery/2.1'
      },
      body: JSON.stringify(query),
      cache: 'no-store',
      signal: AbortSignal.timeout(4000)
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[Valhalla Router] Rate limit encountered (429). Falling back to secondary router.');
      }
      throw new Error(`Valhalla API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    const msg = error?.message || String(error);
    const sanitizedMsg = apiKey ? msg.replace(apiKey, '***') : msg;
    console.warn('[Valhalla Router] Request note:', sanitizedMsg);
    throw error;
  }
}
