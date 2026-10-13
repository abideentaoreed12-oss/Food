'use client';
import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { CartDrawer } from '../customer/CartDrawer';
import { RightDrawer } from './RightDrawer';
import { WalletModal } from '../customer/WalletModal';
import { AuthModal } from '../auth/AuthModal';
import { OrderTrackingModal } from '../tracking/OrderTrackingModal';
import { DishCustomizationModal } from '../customer/DishCustomizationModal';
import { MultiRestaurantConflictModal } from '../customer/MultiRestaurantConflictModal';
import { DeliveryAddressModal } from '../common/DeliveryAddressModal';
import { RestaurantDetailModal } from '../customer/RestaurantDetailModal';

import { useRouter } from 'next/navigation';
import { ROUTES } from '../../routes';
import { useAuth } from '../../context/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    try {
      router.prefetch(ROUTES.HOME);
      router.prefetch(ROUTES.RESTAURANTS);
      router.prefetch(ROUTES.OFFERS);
      router.prefetch(ROUTES.SEARCH);
      router.prefetch(ROUTES.ORDERS);
      router.prefetch(ROUTES.CART);
      router.prefetch(ROUTES.HELP);
      router.prefetch(ROUTES.TERMS);
      router.prefetch(ROUTES.PRIVACY);
      router.prefetch(ROUTES.PARTNER);
      router.prefetch(ROUTES.CONTACT);
    } catch {}
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-950 flex flex-col font-sans selection:bg-[#0D4F3C] selection:text-white">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      {!loading && !user && <Footer />}
      <BottomNav />
      <CartDrawer />
      <RightDrawer />
      <WalletModal />
      <AuthModal />
      <OrderTrackingModal />
      <DishCustomizationModal />
      <MultiRestaurantConflictModal />
      <DeliveryAddressModal />
      <RestaurantDetailModal />
    </div>
  );
}
