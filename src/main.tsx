import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global Google Maps quota failure listener
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => String(a)).join(' ');
  if (
    msg.includes('The Google Maps JavaScript API failed to load') ||
    msg.includes('Google Maps JavaScript API could not load') ||
    msg.includes('Google Maps JavaScript API error')
  ) {
    console.warn(...args);
    return;
  }
  origError.apply(console, args);
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

// Anti-BfCache: Force clean page refresh if navigating back in browser after session logout
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });
}

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
