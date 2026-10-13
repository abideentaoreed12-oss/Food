import type { Metadata } from 'next';
import { CartPage } from '../../src/components/pages/CartPage';

export const metadata: Metadata = {
  title: 'My Cart & Checkout | Veyrang',
  description: 'Review your meal selections and complete your secure order on Veyrang.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/cart' }
};

export default function CartRoute() {
  return <CartPage />;
}
