import type { Metadata } from 'next';
import { SearchPage } from '../../src/components/pages/SearchPage';

export const metadata: Metadata = {
  title: 'Search Dishes & Kitchens | Veyrang',
  description: 'Search favorite dishes, local cuisines, and partner kitchens on Veyrang.',
  alternates: { canonical: '/search' },
  openGraph: {
    title: 'Search Dishes & Kitchens | Veyrang',
    description: 'Search favorite dishes, local cuisines, and partner kitchens on Veyrang.',
    url: 'https://www.veyrang.com/search',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function SearchRoute() {
  return <SearchPage />;
}
