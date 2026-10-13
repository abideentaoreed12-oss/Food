import type { Metadata } from 'next';
import { TermsPage } from '../../src/components/pages/TermsPage';

export const metadata: Metadata = {
  title: 'Terms of Service | Veyrang',
  description: 'Terms governing use of Veyrang food ordering, delivery, and digital wallet services.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | Veyrang',
    description: 'Terms governing use of Veyrang food ordering, delivery, and digital wallet services.',
    url: 'https://www.veyrang.com/terms',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function TermsRoute() {
  return <TermsPage />;
}
