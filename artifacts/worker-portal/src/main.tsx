import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[PWA] ServiceWorker registered with scope: ', registration.scope);
      },
      (err) => {
        console.error('[PWA] ServiceWorker registration failed: ', err);
      }
    );
  });
}
