import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { AccountPage } from '../../src/components/pages/AccountPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account & Addresses | Veyrang',
  description: 'Manage your Veyrang profile, addresses and preferences.',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: true }
};

export default function AccountRoute() {
  return (
    <CustomerRouteShell initialPage="account">
      <AccountPage />
    </CustomerRouteShell>
  );
}
