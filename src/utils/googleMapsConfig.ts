export const GOOGLE_MAPS_API_KEY: string =
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY)) ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.GOOGLE_MAPS_API_KEY) ||
  'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw';

export const DEFAULT_MAP_CENTER = { lat: 6.4474, lng: 3.4723 }; // Lagos (VI / Lekki)
