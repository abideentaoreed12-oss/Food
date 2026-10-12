// Google Maps API Key configuration with provisioned demo fallback
export const GOOGLE_MAPS_API_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
  'AIzaSyAmbptl02WYRIvSdBljM2NahJAjnf-OfUw';

// Viewport placeholder only, never a user or restaurant location.
export const DEFAULT_MAP_CENTER = { lat: 0, lng: 0 };
