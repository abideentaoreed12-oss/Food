import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { PartnerPage } from '../../src/components/pages/PartnerPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partner with Veyrang',
  description: 'Join Veyrang as a restaurant merchant or courier partner.',
  alternates: { canonical: '/partner' }
};

export default function PartnerRoute() {
  return (
    <CustomerRouteShell initialPage="partner">
      <PartnerPage />
    </CustomerRouteShell>
  );
}
