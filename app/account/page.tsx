import type { Metadata } from 'next';
import { AccountPage } from '../../src/components/pages/AccountPage';

export const metadata: Metadata = {
  title: 'My Account & Wallet | Veyrang',
  description: 'Manage personal profile, delivery addresses, wallet balance, and security settings on Veyrang.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' }
};

export default function AccountRoute() {
  return <AccountPage />;
}
