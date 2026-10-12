import type { Metadata } from 'next';
import { HelpPage } from '../../src/components/pages/HelpPage';

export const metadata: Metadata = {
  title: 'Help Centre & FAQs | Veyrang',
  description: 'Find answers to common questions about orders, delivery, refunds, payments, and account management.',
  alternates: { canonical: '/help' },
  openGraph: {
    title: 'Help Centre & FAQs | Veyrang',
    description: 'Find answers to common questions about orders, delivery, refunds, payments, and account management.',
    url: 'https://www.veyrang.com/help',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function HelpRoute() {
  return <HelpPage />;
}
