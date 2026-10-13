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

import { siteDataManager } from '../lib/siteDataSnapshot';
import { Providers } from './_shell/Providers';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialSnapshot: any = null;
  try {
    initialSnapshot = siteDataManager.getLastKnownGood() || await siteDataManager.servePublicCatalogue();
  } catch (err) {
    console.warn('[RootLayout] Snapshot bootstrap note:', err);
  }

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
        <Providers initialSnapshot={initialSnapshot}>{children}</Providers>
      </body>
    </html>
  );
}
