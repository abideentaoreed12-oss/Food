'use client';

import React, { useState, useEffect } from 'react';
import { AuthProvider } from '../../src/context/AuthContext';
import { DeliveryProvider } from '../../src/context/DeliveryContext';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../src/utils/googleMapsConfig';
import { AppShell } from '../../src/components/layout/AppShell';
import { PaystackReturnHandler } from './PaystackReturnHandler';

export function Providers({ children }: { children: React.ReactNode }) {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (window as any).gm_authFailure = () => {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    };

    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const msg = args.map((a) => String(a)).join(' ');
      if (
        msg.includes('OverQuotaMapError') ||
        msg.includes('QuotaExceededError') ||
        msg.includes('ApiMapError')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    };

    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);

    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
      console.error = origError;
    };
  }, []);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'geometry']}>
      <AuthProvider>
        <DeliveryProvider>
          <PaystackReturnHandler />
          {quotaExceeded && (
            <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
              <span>
                Google Maps Platform quota reached. If you are the app owner, visit{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-amber-950 hover:text-amber-800"
                >
                  maps developer site
                </a>{' '}
                for instructions to update your account.
              </span>
            </div>
          )}
          <AppShell>
            {children}
          </AppShell>
        </DeliveryProvider>
      </AuthProvider>
    </APIProvider>
  );
}
