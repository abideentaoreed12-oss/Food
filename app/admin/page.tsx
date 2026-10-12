import type { Metadata } from 'next';
import { AdminPortalRoute } from './AdminPortalRoute';

export const metadata: Metadata = {
  title: 'Admin Operations Control Center | Veyrang',
  description: 'Veyrang platform administration, merchant operations, orders, and system settings.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/admin' }
};

export default function AdminPage() {
  return <AdminPortalRoute />;
}
