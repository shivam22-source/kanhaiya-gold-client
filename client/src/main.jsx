import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './utils/appEnhancements';
import './utils/branchCashInChargeBehavior';
import './utils/appraiserAccountOverride';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);



if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
   navigator.serviceWorker.register('/sw.js').then((registration) => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration.update();
    }
  });
}).catch(() => {});
  });
}

let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
