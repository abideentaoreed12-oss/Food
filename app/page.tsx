import App from '../src/App';

export default function Page() {
  // Render the actual app immediately. A client-only mount gate leaves the
  // homepage showing "Loading Veyrang..." to crawlers and can appear stuck.
  return <App />;
}
