import type { Metadata } from 'next';
import App from '../../src/App';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Restaurant Kitchen Portal | Veyrang',
  description: 'Veyrang restaurant kitchen display and order management portal.',
  alternates: { canonical: '/restaurant' },
  robots: { index: false, follow: false }
};

export default function RestaurantPortalRoute() {
  return <App initialRole="restaurant" />;
}
