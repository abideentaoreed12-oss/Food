import type { Metadata } from 'next';
import { ContactPage } from '../../src/components/pages/ContactPage';

export const metadata: Metadata = {
  title: 'Contact Support | Veyrang',
  description: 'Get in touch with Veyrang customer support, partner operations, and delivery care.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Support | Veyrang',
    description: 'Get in touch with Veyrang customer support, partner operations, and delivery care.',
    url: 'https://www.veyrang.com/contact',
    siteName: 'Veyrang',
    type: 'website'
  }
};

export default function ContactRoute() {
  return <ContactPage />;
}
