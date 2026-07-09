import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
let hasPendingSwUpdate = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (hasPendingSwUpdate) return;
    hasPendingSwUpdate = true;
    toast(`🔄 Update available (${APP_VERSION}). Refresh when you're ready.`, {
      icon: '⬆️',
      duration: 6000,
    });
  },
  onOfflineReady() {
    // App is ready to work offline; no reload needed.
  },
});

const checkForUpdates = () => {
  if (hasPendingSwUpdate) return;
  updateSW();
};

// Only poll for updates when the app is visible. Frequent checks while the
// user is interacting with the roster (which involves rapid focus/blur events
// on form elements) used to trigger service-worker updates that reload the page.
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
const startUpdatePolling = () => {
  if (updateIntervalId) return;
  checkForUpdates();
  updateIntervalId = setInterval(checkForUpdates, 300_000);
};
const stopUpdatePolling = () => {
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
};

if (document.visibilityState === 'visible') {
  startUpdatePolling();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    startUpdatePolling();
  } else {
    stopUpdatePolling();
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
