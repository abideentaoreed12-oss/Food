'use client';

/**
 * GlobalLoadingHandler:
 * Retained for backwards-compatibility. Loader dismissal is now handled safely
 * by AppLoadingScreen within React's Fiber lifecycle to prevent NotFoundError
 * DOM reconciliation conflicts.
 */
export function GlobalLoadingHandler() {
  return null;
}
