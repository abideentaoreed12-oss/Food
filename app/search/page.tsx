import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { SearchPage } from '../../src/components/pages/SearchPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search Restaurants and Dishes | Veyrang',
  description: 'Search restaurants and dishes on Veyrang.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true }
};

export default function SearchRoute() {
  return (
    <CustomerRouteShell initialPage="search">
      <SearchPage />
    </CustomerRouteShell>
  );
}
