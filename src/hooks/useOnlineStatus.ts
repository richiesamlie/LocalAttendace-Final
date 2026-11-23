import { useState, useEffect } from 'react';

function isLoopbackHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (isLoopbackHost()) return true;
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (!isLoopbackHost() && typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) setIsOnline(false);
        return;
      }
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (isMounted) {
          setIsOnline(res.ok);
        }
      } catch (_err) {
        if (isMounted) {
          setIsOnline(false);
        }
      }
    };

    const handleOnline = () => {
      if (isLoopbackHost()) {
        void checkHealth();
      } else {
        setIsOnline(true);
      }
    };
    const handleOffline = () => {
      if (isLoopbackHost()) {
        void checkHealth();
      } else {
        setIsOnline(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pingInterval = setInterval(() => {
      void checkHealth();
    }, 5000);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  return isOnline;
}
