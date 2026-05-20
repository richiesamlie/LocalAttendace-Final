import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pingInterval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (_err) {
        setIsOnline(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  return isOnline;
}
