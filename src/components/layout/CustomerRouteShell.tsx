'use client';

import React, { type ReactNode } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { DeliveryProvider, useDelivery } from '../../context/DeliveryContext';
import { Navbar } from './Navbar';
import { RightDrawer } from './RightDrawer';
import { DishCustomizationModal } from '../customer/DishCustomizationModal';
import { CartDrawer } from '../customer/CartDrawer';
import { RestaurantDetailModal } from '../customer/RestaurantDetailModal';
import { MultiRestaurantConflictModal } from '../customer/MultiRestaurantConflictModal';
import { FloatingCartBar } from '../customer/FloatingCartBar';
import { OrderTrackingModal } from '../tracking/OrderTrackingModal';
import { AuthModal } from '../auth/AuthModal';
import { WalletModal } from '../customer/WalletModal';
import { DeliveryAddressModal } from '../common/DeliveryAddressModal';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '../../utils/googleMapsConfig';

function CustomerRouteFrame({ children }: { children: ReactNode }) {
  const { activeRole, isWalletModalOpen, setIsWalletModalOpen } = useDelivery();
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-[#0D4F3C] selection:text-white">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-36">
        {children}
      </main>
      <RightDrawer />
      {activeRole === 'customer' && (
        <>
          <DishCustomizationModal />
          <CartDrawer />
          <RestaurantDetailModal />
          <MultiRestaurantConflictModal />
          <FloatingCartBar />
        </>
      )}
      <OrderTrackingModal />
      <AuthModal />
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      <DeliveryAddressModal />
      {activeRole === 'customer' && !isAuthenticated && <Footer />}
      {activeRole === 'customer' && <BottomNav />}
    </div>
  );
}

export function CustomerRouteShell({ children, initialPage }: { children: ReactNode; initialPage: 'offers' | 'search' }) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'geometry']} onError={(error) => console.warn('Optional map display unavailable:', error)}>
      <AuthProvider>
        <DeliveryProvider initialRole="customer" initialPage={initialPage}>
          <CustomerRouteFrame>{children}</CustomerRouteFrame>
        </DeliveryProvider>
      </AuthProvider>
    </APIProvider>
  );
}
