import type { Metadata } from 'next';
import App from '../../src/App';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All Restaurants | Veyrang',
  description: 'Order from trusted local kitchens across your city. Fast delivery and real-time tracking.',
  alternates: { canonical: '/restaurants' },
  openGraph: {
    title: 'All Restaurants | Veyrang',
    description: 'Order from trusted local kitchens across your city. Fast delivery and real-time tracking.',
    url: 'https://www.veyrang.com/restaurants',
    siteName: 'Veyrang',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'All Restaurants | Veyrang',
    description: 'Order from trusted local kitchens across your city.'
  }
};

export default function RestaurantsRoute() {
  return <App initialPage="restaurants" />;
}
