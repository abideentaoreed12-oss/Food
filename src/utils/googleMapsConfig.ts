export const GOOGLE_MAPS_API_KEY: string =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.GOOGLE_MAPS_API_KEY) ||
  '';

export const DEFAULT_MAP_CENTER = { lat: 6.4474, lng: 3.4723 }; // Lagos (VI / Lekki)
