'use client';

import React from 'react';
import { useAuth } from '../src/context/AuthContext';
import { useDelivery } from '../src/context/DeliveryContext';
import { LandingPage } from '../src/components/landing/LandingPage';
import { CustomerView } from '../src/components/customer/CustomerView';

export default function HomePage() {
  const { user } = useAuth();
  const { activePage } = useDelivery();

  // Unauthenticated guests see the high-conversion landing page unless exploring storefront
  if (!user && activePage !== 'home') {
    return <LandingPage />;
  }

  return <CustomerView />;
}
