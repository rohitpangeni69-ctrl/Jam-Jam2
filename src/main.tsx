import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { initAppCheck } from './lib/appCheck';
import { initAnalytics } from './lib/analytics';
import { initCrashReporting } from './lib/crashReporting';

// Initialize production scale & security features
initAppCheck();
initAnalytics();
initCrashReporting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
