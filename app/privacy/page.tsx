import type { Metadata } from 'next';
import { PrivacyPage } from '../../src/components/pages/PrivacyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | Veyrang',
  description: 'How Veyrang handles account, delivery, order, and payment-related information securely.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | Veyrang',
    description: 'How Veyrang handles account, delivery, order, and payment-related information securely.',
    url: 'https://www.veyrang.com/privacy',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function PrivacyRoute() {
  return <PrivacyPage />;
}
