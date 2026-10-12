'use client';
import React from 'react';
import { useDelivery } from '../src/context/DeliveryContext';
import { LandingPage } from '../src/components/landing/LandingPage';
import { CustomerView } from '../src/components/customer/CustomerView';
import { RestaurantsPage } from '../src/components/pages/RestaurantsPage';
import { OffersPage } from '../src/components/pages/OffersPage';
import { OrdersPage } from '../src/components/pages/OrdersPage';
import { FavouritesPage } from '../src/components/pages/FavouritesPage';
import { AccountPage } from '../src/components/pages/AccountPage';
import { RestaurantPortal } from '../src/components/restaurant/RestaurantPortal';
import { CourierView } from '../src/components/courier/CourierView';
import { AdminPortal } from '../src/components/admin/AdminPortal';

export const dynamic = 'force-dynamic';

export default function Page() {
  const { activeRole, activePage } = useDelivery();

  if (activeRole === 'restaurant') return <RestaurantPortal />;
  if (activeRole === 'courier') return <CourierView />;
  if (activeRole === 'admin') return <AdminPortal />;

  if (activeRole === 'customer') {
    if (activePage === 'landing') return <LandingPage />;
    if (activePage === 'home') return <CustomerView />;
    if (activePage === 'restaurants') return <RestaurantsPage />;
    if (activePage === 'offers') return <OffersPage />;
    if (activePage === 'orders') return <OrdersPage />;
    if (activePage === 'favourites') return <FavouritesPage />;
    if (activePage === 'account') return <AccountPage />;
  }

  return <CustomerView />;
}
