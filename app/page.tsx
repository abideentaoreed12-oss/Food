'use client';

import React from 'react';
import { useAuth } from '../src/context/AuthContext';
import { LandingPage } from '../src/components/landing/LandingPage';
import { CustomerView } from '../src/components/customer/CustomerView';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, loading } = useAuth();


  // Unauthenticated guests see the high-conversion landing page; authenticated users see the storefront
  if (!user) {
    return <LandingPage />;
  }

  return <CustomerView />;
}
