'use client';

import React, { useEffect, useState } from 'react';

export interface AppLoadingScreenProps {
  /**
   * If provided, controls the loader visibility externally.
   * When true, keeps loader visible.
   * When false (or omitted), initiates smooth fade out after minDuration.
   */
  isLoading?: boolean;
  /** Custom logo or image URL. If omitted, uses the branded Veyrang mark. */
  logoSrc?: string;
  /** Alt text for the logo (for accessibility) */
  logoAlt?: string;
  /** Minimum time in ms to show the loader to prevent jarring flashes (default: 300ms) */
  minDuration?: number;
  /** Callback fired once the loader has completely faded out and unmounted */
  onDismissed?: () => void;
}

/**
 * Production-quality, accessible full-screen loader for food delivery apps (Item7go style).
 * - Background: Pure white (#ffffff)
 * - Perfectly centered vertically & horizontally
 * - Smooth 350ms ease fade-out transition, then completely unmounted and removed from DOM by React
 * - Zero hydration conflicts or DOM reconciliation errors (no dangerous direct DOM manipulation)
 * - Accessible: role="status", aria-label="Loading…", aria-live="polite"
 */
export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  isLoading,
  logoSrc,
  logoAlt = 'Loading application',
  minDuration = 100,
  onDismissed,
}) => {
  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // If explicitly controlled externally and still loading, keep visible
    if (isLoading === true) return;

    // Wait minDuration to ensure initial paint is ready, then fade out smoothly
    const timer = setTimeout(() => {
      setFading(true);
      const removeTimer = setTimeout(() => {
        setMounted(false);
        onDismissed?.();
      }, 250); // Matches transition duration

      return () => clearTimeout(removeTimer);
    }, minDuration);

    return () => clearTimeout(timer);
  }, [isLoading, minDuration, onDismissed]);

  // When unmounted, React removes the element cleanly from the DOM without breaking Fiber reconciliation
  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-label="Loading…"
      aria-live="polite"
      className={`fixed inset-0 z-[999999] flex items-center justify-center bg-white select-none pointer-events-none transition-opacity duration-250 ease-out ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#ffffff',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
      }}
    >
      <div className="relative flex items-center justify-center w-20 h-20">
        {/* Sleek spinning circular ring */}
        <div
          className="absolute inset-0 rounded-full border-[2.5px] border-slate-100 border-t-[#0D4F3C] border-r-[#0D4F3C] animate-spin"
          style={{ animationDuration: '0.85s' }}
          aria-hidden="true"
        />

        {/* Center circular badge with gentle pulsing brand mark */}
        <div className="relative w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-[0_4px_16px_rgba(13,79,60,0.08)] animate-pulse">
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={logoAlt}
              className="w-8 h-8 rounded-full object-contain"
            />
          ) : (
            <svg
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 drop-shadow-sm"
              aria-hidden="true"
            >
              <circle cx="28" cy="24" r="8" fill="#0D4F3C" />
              <path
                d="M26 44C26 36 34 30 46 30C58 30 68 38 72 50C76 62 70 76 56 78C42 80 26 70 26 56V44Z"
                fill="#0D4F3C"
              />
              <path
                d="M48 30C56 36 64 46 64 58C64 68 56 76 46 78C56 72 60 58 56 46C52 38 48 32 48 30Z"
                fill="#E8C547"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
