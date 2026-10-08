// Service to interface with hosted Valhalla routing API
// API Endpoint: https://valhalla.openstreetmap.de/route

export interface ValhallaRouteParams {
  locations: { lat: number; lon: number }[];
  costing: 'auto' | 'bicycle' | 'pedestrian';
}

export async function getValhallaRoute(params: ValhallaRouteParams) {
  const endpoint = 'https://valhalla.openstreetmap.de/route';
  
  const query = {
    locations: params.locations.map(loc => ({ lat: loc.lat, lon: loc.lon })),
    costing: params.costing,
    units: 'kilometers',
    directions_options: { units: 'kilometers' }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Valhalla API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Valhalla Routing Error:', error);
    throw error;
  }
}
