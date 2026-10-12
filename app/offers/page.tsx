import type { Metadata } from 'next';
import App from '../../src/App';

export const metadata: Metadata = {
  title: 'Offers & Promo Codes | Veyrang Food Delivery',
  description: 'Verified promo codes, meal discounts, and exclusive food delivery offers across top restaurants on Veyrang.',
  alternates: { canonical: '/offers' },
  openGraph: {
    title: 'Offers & Promo Codes | Veyrang Food Delivery',
    description: 'Verified promo codes, meal discounts, and exclusive food delivery offers across top restaurants on Veyrang.',
    url: 'https://www.veyrang.com/offers',
    siteName: 'Veyrang Food Delivery',
    type: 'website',
    locale: 'en_NG'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Offers & Promo Codes | Veyrang Food Delivery',
    description: 'Verified promo codes, meal discounts, and exclusive food delivery offers on Veyrang.'
  }
};

export default function OffersRoutePage() {
  return <App initialPage="offers" />;
}
