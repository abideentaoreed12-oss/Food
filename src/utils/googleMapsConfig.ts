// Optional Google Maps UI configuration. No committed API-key fallback.
export const GOOGLE_MAPS_API_KEY: string =
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY)) ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.GOOGLE_MAPS_API_KEY) || '';

// Neutral viewport only; never use as a customer, restaurant, or courier coordinate.
export const DEFAULT_MAP_CENTER = { lat: 0, lng: 0 };
