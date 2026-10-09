import type { Metadata } from 'next';
import App from '../../src/App';

export const metadata: Metadata = {
  title: 'Admin Operations Control Center | Veyrang',
  description: 'Veyrang platform administration, merchant operations, orders, and system settings.',
  alternates: { canonical: '/admin' }
};

export default function AdminPage() {
  return <App initialRole="admin" />;
}
