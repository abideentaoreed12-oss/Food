import type { Metadata } from 'next';
import { OrdersPage } from '../../src/components/pages/OrdersPage';

export const metadata: Metadata = {
  title: 'My Orders | Veyrang',
  description: 'View order history, receipts, and track live deliveries on Veyrang.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/orders' }
};

export default function OrdersRoute() {
  return <OrdersPage />;
}
