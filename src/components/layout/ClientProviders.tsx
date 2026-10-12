'use client';

import React from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { DeliveryProvider } from '../../context/DeliveryContext';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../utils/googleMapsConfig';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'geometry']}>
      <AuthProvider>
        <DeliveryProvider>
          {children}
        </DeliveryProvider>
      </AuthProvider>
    </APIProvider>
  );
}
