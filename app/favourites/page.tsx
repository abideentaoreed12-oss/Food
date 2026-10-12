import type { Metadata } from 'next';
import { FavouritesPage } from '../../src/components/pages/FavouritesPage';

export const metadata: Metadata = {
  title: 'My Favourites | Veyrang',
  description: 'Your saved favorite restaurants and cuisines on Veyrang.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/favourites' }
};

export default function FavouritesRoute() {
  return <FavouritesPage />;
}
