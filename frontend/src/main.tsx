import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './lib/api';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import App from './App';
import { OfflineGate } from './components/OfflineGate';
import { isAndroidApp } from './lib/platform';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/figtree';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    },
    mutations: { retry: 0 },
  },
});

// Tells the boot fallback in index.html that the bundle loaded and ran.
(window as unknown as { __m360Booted?: boolean }).__m360Booted = true;
if (isAndroidApp) void import('./native/init').then((m) => m.initNative()).catch((e) => console.warn('[native] init failed', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <OfflineGate>
                <App />
              </OfflineGate>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
