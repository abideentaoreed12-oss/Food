import type { Metadata } from 'next';
import App from '../../src/App';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Courier Rider Portal | Veyrang',
  description: 'Veyrang courier dispatch and delivery portal.',
  alternates: { canonical: '/courier' },
  robots: { index: false, follow: false }
};

export default function CourierPortalRoute() {
  return <App initialRole="courier" />;
}
