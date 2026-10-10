import type { Metadata } from 'next';
import HandoverPage from '../../../src/components/pages/HandoverPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Secure Delivery Handover | VeyraNG',
  robots: { index: false, follow: false }
};

export default function Page() {
  return <HandoverPage />;
}
