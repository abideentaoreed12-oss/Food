import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { OrdersPage } from '../../src/components/pages/OrdersPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Orders | Veyrang',
  description: 'Track and manage your Veyrang food delivery orders.',
  alternates: { canonical: '/orders' },
  robots: { index: false, follow: true }
};

export default function OrdersRoute() {
  return (
    <CustomerRouteShell initialPage="orders">
      <OrdersPage />
    </CustomerRouteShell>
  );
}
