'use client';

import React from 'react';
import { UserRole } from './types';
import { AuthProvider } from './context/AuthContext';
import { DeliveryProvider, useDelivery } from './context/DeliveryContext';
import { Navbar } from './components/layout/Navbar';
import { RightDrawer } from './components/layout/RightDrawer';
import { CustomerView } from './components/customer/CustomerView';
import { RestaurantsPage } from './components/pages/RestaurantsPage';
import { SearchPage } from './components/pages/SearchPage';
import { OffersPage } from './components/pages/OffersPage';
import { OrdersPage } from './components/pages/OrdersPage';
import { FavouritesPage } from './components/pages/FavouritesPage';
import { AccountPage } from './components/pages/AccountPage';
import { HelpPage } from './components/pages/HelpPage';
import { PartnerPage } from './components/pages/PartnerPage';
import { TermsPage } from './components/pages/TermsPage';
import { PrivacyPage } from './components/pages/PrivacyPage';
import { ContactPage } from './components/pages/ContactPage';
import { RestaurantPortal } from './components/restaurant/RestaurantPortal';
import { CourierView } from './components/courier/CourierView';
import { AdminPortal } from './components/admin/AdminPortal';
import { DishCustomizationModal } from './components/customer/DishCustomizationModal';
import { CartDrawer } from './components/customer/CartDrawer';
import { RestaurantDetailModal } from './components/customer/RestaurantDetailModal';
import { OrderTrackingModal } from './components/tracking/OrderTrackingModal';
import { AuthModal } from './components/auth/AuthModal';
import { PortalAuthGuard } from './components/auth/PortalAuthGuard';
import { WalletModal } from './components/customer/WalletModal';
import { BottomNav } from './components/layout/BottomNav';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './components/landing/LandingPage';
import { FloatingCartBar } from './components/customer/FloatingCartBar';
import { MultiRestaurantConflictModal } from './components/customer/MultiRestaurantConflictModal';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from './utils/googleMapsConfig';

const AppContent: React.FC = () => {
  const { activeRole, setActiveRole, activePage, setActivePage, isWalletModalOpen, setIsWalletModalOpen } = useDelivery();

  const renderCustomerPage = () => {
    switch (activePage) {
      case 'landing':
        return <LandingPage />;
      case 'home':
        return <CustomerView />;
      case 'restaurants':
        return <RestaurantsPage />;
      case 'search':
        return <SearchPage />;
      case 'offers':
        return <OffersPage />;
      case 'orders':
        return <OrdersPage />;
      case 'favourites':
        return <FavouritesPage />;
      case 'account':
        return <AccountPage />;
      case 'help':
        return <HelpPage />;
      case 'partner':
        return <PartnerPage />;
      case 'terms':
        return <TermsPage />;
      case 'privacy':
        return <PrivacyPage />;
      case 'contact':
        return <ContactPage />;
      default:
        return <CustomerView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Sticky Top Header Navigation */}
      <Navbar />

      {/* Role View Banner when not in Customer Mode */}
      {activeRole !== 'customer' && (
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-2.5 text-xs flex items-center justify-between border-b border-slate-800 shadow-md sticky top-14 sm:top-16 z-30">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300 hidden sm:inline">Active Portal:</span>
            <span className="font-extrabold text-white uppercase tracking-wider bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">
              {activeRole === 'restaurant' && 'Merchant Kitchen (KDS)'}
              {activeRole === 'admin' && 'Admin Operations Console'}
              {activeRole === 'courier' && 'Courier Rider Portal'}
            </span>
          </div>
          <button
            onClick={() => {
              setActiveRole('customer');
              setActivePage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="bg-[#FF5500] hover:bg-[#EA4C00] text-white px-3.5 py-1 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>← Back to Customer Storefront</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${activeRole === 'admin' ? 'max-w-none px-0 pt-0 pb-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-36'}`}>
        {activeRole === 'customer' && renderCustomerPage()}
        {activeRole === 'restaurant' && (
          <PortalAuthGuard requiredRole="restaurant">
            <RestaurantPortal />
          </PortalAuthGuard>
        )}
        {activeRole === 'courier' && (
          <PortalAuthGuard requiredRole="courier">
            <CourierView />
          </PortalAuthGuard>
        )}
        {activeRole === 'admin' && (
          <PortalAuthGuard requiredRole="admin">
            <AdminPortal />
          </PortalAuthGuard>
        )}
      </main>

      {/* Right Drawer Navigation (Triggered by ☰ Menu button) */}
      <RightDrawer />

      {/* Slide-overs & Interactive Modals */}
      <DishCustomizationModal />
      <CartDrawer />
      <RestaurantDetailModal />
      <OrderTrackingModal />
      <AuthModal />
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      <MultiRestaurantConflictModal />

      {/* Floating Sticky Cart Banner */}
      <FloatingCartBar />

      {/* Corporate Multi-Column Footer */}
      {activeRole === 'customer' && <Footer />}

      {/* Floating Bottom Pill Navigation Bar */}
      {activeRole === 'customer' && <BottomNav />}
    </div>
  );
};

export default function App({ initialRole }: { initialRole?: UserRole } = {}) {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key is missing. Loading app without Maps API provider.');
    return (
      <AuthProvider>
        <DeliveryProvider initialRole={initialRole}>
          <AppContent />
        </DeliveryProvider>
      </AuthProvider>
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      libraries={['places', 'geometry']}
      onError={(error) => {
        console.warn('Google Maps APIProvider error:', error);
      }}
    >
      <AuthProvider>
        <DeliveryProvider initialRole={initialRole}>
          <AppContent />
        </DeliveryProvider>
      </AuthProvider>
    </APIProvider>
  );
}
