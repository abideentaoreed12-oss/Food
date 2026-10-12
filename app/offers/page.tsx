import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { OffersPage } from '../../src/components/pages/OffersPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Special Offers & Promo Codes | Veyrang',
  description: 'Discover active promo codes, restaurant discounts, and cashback deals on Veyrang.',
  alternates: { canonical: '/offers' },
  openGraph: {
    title: 'Special Offers & Promo Codes | Veyrang',
    description: 'Discover active promo codes, restaurant discounts, and cashback deals on Veyrang.',
    url: 'https://www.veyrang.com/offers',
    siteName: 'Veyrang',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'Special Offers & Promo Codes | Veyrang',
    description: 'Discover active promo codes and restaurant discounts.'
  }
};

export default function OffersRoute() {
  return (
    <CustomerRouteShell initialPage="offers">
      <OffersPage />
    </CustomerRouteShell>
  );
}
