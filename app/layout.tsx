import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.veyrang.com'),
  title: {
    default: 'Veyrang | Food Delivery & Cloud Kitchens',
    template: '%s | Veyrang'
  },
  description: 'Discover restaurants and order food for delivery with Veyrang.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Veyrang | Food Delivery & Cloud Kitchens',
    description: 'Discover restaurants and order food for delivery with Veyrang.',
    url: 'https://www.veyrang.com/',
    siteName: 'Veyrang',
    type: 'website',
    locale: 'en_NG'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veyrang | Food Delivery & Cloud Kitchens',
    description: 'Discover restaurants and order food for delivery with Veyrang.'
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[#F8F9FA] text-slate-900">
        {children}
      </body>
    </html>
  );
}
