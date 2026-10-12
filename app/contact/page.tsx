import type { Metadata } from 'next';
import { CustomerRouteShell } from '../../src/components/layout/CustomerRouteShell';
import { ContactPage } from '../../src/components/pages/ContactPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contact Us | Veyrang',
  description: 'Contact Veyrang support for order, payment or account help.',
  alternates: { canonical: '/contact' }
};

export default function ContactRoute() {
  return (
    <CustomerRouteShell initialPage="contact">
      <ContactPage />
    </CustomerRouteShell>
  );
}
