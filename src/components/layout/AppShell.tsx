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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-950 flex flex-col font-sans selection:bg-[#0D4F3C] selection:text-white">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
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
