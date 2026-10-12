import type { Metadata } from 'next';
import { RestaurantPortalRoute } from './RestaurantPortalRoute';

export const metadata: Metadata = {
  title: 'Merchant Kitchen KDS Portal | Veyrang',
  description: 'Manage live incoming ticket orders, prep times, kitchen status toggles, and food catalog inventory.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/restaurant' }
};

export default function RestaurantPage() {
  return <RestaurantPortalRoute />;
}
