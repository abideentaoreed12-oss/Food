import type { Metadata } from 'next';
import { LandingPage } from '../src/components/landing/LandingPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' }
};

export default function Page() {
  return <LandingPage />;
}
