'use client';

import React from 'react';
import { useAuth } from '../src/context/AuthContext';
import { LandingPage } from '../src/components/landing/LandingPage';
import { CustomerView } from '../src/components/customer/CustomerView';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#0D4F3C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unauthenticated guests see the high-conversion landing page; authenticated users see the storefront
  if (!user) {
    return <LandingPage />;
  }

  return <CustomerView />;
}
