import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.veyrang.com'),
  title: {
    default: 'Veyrang Food Delivery',
    template: '%s | Veyrang Food Delivery'
  },
  description: 'Multi-restaurant food delivery platform with live GPS doorstep tracking, customizable menus, and real-time kitchen and courier portals.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Veyrang Food Delivery',
    description: 'Multi-restaurant food delivery platform with live GPS doorstep tracking, customizable menus, and real-time kitchen and courier portals.',
    url: 'https://www.veyrang.com/',
    siteName: 'Veyrang Food Delivery',
    type: 'website',
    locale: 'en_NG'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veyrang Food Delivery',
    description: 'Multi-restaurant food delivery platform with live GPS doorstep tracking, customizable menus, and real-time kitchen and courier portals.'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

import { Providers } from './_shell/Providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-[#F8F9FA] text-slate-900" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
