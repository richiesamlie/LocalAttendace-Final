import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const SW_UPDATE_APPLIED_KEY = 'sw-update-applied';
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    sessionStorage.setItem(SW_UPDATE_APPLIED_KEY, '1');
    updateSW(true);
  },
  onOfflineReady() {
    // App is ready to work offline; no reload needed.
  },
});

const checkForUpdates = () => {
  updateSW();
};

// Only poll for updates when the app is visible. Frequent checks while the
// user is interacting with the roster (which involves rapid focus/blur events
// on form elements) used to trigger service-worker updates that reload the page.
let updateIntervalId: ReturnType<typeof setInterval> | null = null;
const startUpdatePolling = () => {
  if (updateIntervalId) return;
  checkForUpdates();
  updateIntervalId = setInterval(checkForUpdates, 60_000);
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

if (sessionStorage.getItem(SW_UPDATE_APPLIED_KEY) === '1') {
  sessionStorage.removeItem(SW_UPDATE_APPLIED_KEY);
  toast.success(`🚀 Aplikasi diperbarui ke versi ${APP_VERSION}`, {
    icon: '✅',
    duration: 4500,
  });
}

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
