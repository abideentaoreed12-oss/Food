import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { FavouritesPage } from '../../src/components/pages/FavouritesPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Favourites | Veyrang',
  description: 'Your favourite restaurants and dishes on Veyrang.',
  alternates: { canonical: '/favourites' },
  robots: { index: false, follow: true }
};

export default function FavouritesRoute() {
  return (
    <CustomerRouteShell initialPage="favourites">
      <FavouritesPage />
    </CustomerRouteShell>
  );
}
