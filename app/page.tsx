import type { Metadata } from 'next';
import App from '../src/App';

export const metadata: Metadata = {
  alternates: { canonical: '/' }
};

export default function Page() {
  // Render the actual app immediately. A client-only mount gate leaves the
  // homepage showing "Loading Veyrang..." to crawlers and can appear stuck.
  return <App />;
}
