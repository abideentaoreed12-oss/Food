import type { Metadata } from 'next';
import { siteDataManager } from '../../lib/siteDataSnapshot';
import { RestaurantListClient } from '../../src/components/restaurant/RestaurantListClient';

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

export const revalidate = 60;

export default async function RestaurantsRoute() {
  let restaurants: any[] = [];
  try {
    const snapshot = siteDataManager.getLastKnownGood();
    restaurants = snapshot?.restaurants || [];
  } catch (err) {
    console.warn('Failed to load restaurants catalog in RSC:', err);
  }
  
  return <RestaurantListClient initialRestaurants={restaurants} />;
}
