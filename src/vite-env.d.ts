/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

interface ImportMetaEnv {
  readonly GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}
