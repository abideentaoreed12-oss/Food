// Google Maps is optional for map rendering/autocomplete only; routing and geocoding use free OSM services.
export const GOOGLE_MAPS_API_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) || '';

// Viewport placeholder only, never a user or restaurant location.
export const DEFAULT_MAP_CENTER = { lat: 0, lng: 0 };
