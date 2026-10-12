import type { Metadata } from 'next';
import { CourierPortalRoute } from './CourierPortalRoute';

export const metadata: Metadata = {
  title: 'Courier Rider Dispatch Console | Veyrang',
  description: 'Turn-by-turn routing, pickup dispatch confirmations, and customer handover verification.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/courier' }
};

export default function CourierPage() {
  return <CourierPortalRoute />;
}
