/// <reference types="vite/client" />
/// <reference types="@types/google.maps" />

declare module '*.css';

interface ImportMetaEnv {
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
