import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { HelpPage } from '../../src/components/pages/HelpPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Help & Support | Veyrang',
  description: 'Get help with orders, payments and delivery on Veyrang.',
  alternates: { canonical: '/help' }
};

export default function HelpRoute() {
  return (
    <CustomerRouteShell initialPage="help">
      <HelpPage />
    </CustomerRouteShell>
  );
}
