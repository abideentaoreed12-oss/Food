import type { Metadata } from 'next';
import App from '../../src/App';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search Restaurants and Dishes | Veyrang',
  description: 'Search restaurants and dishes on Veyrang.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true }
};

/**
 * Keep the existing application shell and search implementation intact while
 * making the existing search destination a first-class App Router route.
 * The search UI and its business logic remain in src/components/pages/SearchPage.
 */
export default function SearchRoute() {
  return <App initialPage="search" />;
}
