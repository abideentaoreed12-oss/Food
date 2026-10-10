'use client';

import React from 'react';
import { UserRole } from './types';
const Analytics = () => null;
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

      {/* Customer Modals & Drawers */}
      {activeRole === 'customer' && (
        <>
          <DishCustomizationModal />
          <CartDrawer />
          <RestaurantDetailModal />
          <MultiRestaurantConflictModal />
          <FloatingCartBar />
        </>
      )}

      {/* Cross-Role Modals */}
      <OrderTrackingModal />
      <AuthModal />
      <WalletModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />

      {/* Corporate Multi-Column Footer */}
      {activeRole === 'customer' && <Footer />}

      {/* Floating Bottom Pill Navigation Bar */}
      {activeRole === 'customer' && <BottomNav />}
    </div>
  );
};

class MapsErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('MapsErrorBoundary captured Google Maps error, rendering fallback:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function App({ initialRole }: { initialRole?: UserRole } = {}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <AuthProvider>
      <DeliveryProvider initialRole={initialRole}>
        <AppContent />
        <Analytics />
      </DeliveryProvider>
    </AuthProvider>
  );

  // During SSR and initial client hydration render content directly so server and client match 100%
  if (!mounted || !GOOGLE_MAPS_API_KEY) {
    return content;
  }

  return (
    <MapsErrorBoundary fallback={content}>
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        libraries={['places', 'geometry']}
        onError={(error) => {
          console.warn('Google Maps APIProvider error:', error);
        }}
      >
        {content}
      </APIProvider>
    </MapsErrorBoundary>
  );
}
