import type { Metadata } from 'next';
import { PartnerPage } from '../../src/components/pages/PartnerPage';

export const metadata: Metadata = {
  title: 'Partner with Veyrang | Kitchen & Restaurant Partnerships',
  description: 'Grow your culinary business with thousands of food lovers. Partner with Veyrang today.',
  alternates: { canonical: '/partner' },
  openGraph: {
    title: 'Partner with Veyrang | Kitchen & Restaurant Partnerships',
    description: 'Grow your culinary business with thousands of food lovers. Partner with Veyrang today.',
    url: 'https://www.veyrang.com/partner',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function PartnerRoute() {
  return <PartnerPage />;
}
