import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veyrang - On-Demand Food Delivery & Cloud Kitchens',
  description: 'Hot, delicious meals delivered to your door in 25 minutes across Nigeria and international hubs.',
  openGraph: {
    title: 'Veyrang - On-Demand Food Delivery & Cloud Kitchens',
    description: 'Hot, delicious meals delivered to your door in 25 minutes across Nigeria and international hubs.',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-[#F8F9FA] text-slate-900">
        {children}
      </body>
    </html>
  );
}
