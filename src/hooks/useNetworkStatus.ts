import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isWeak, setIsWeak] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsWeak(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsWeak(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Optional: detect weak network via navigator.connection
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      const updateConnectionStatus = () => {
        if (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          setIsWeak(true);
        } else {
          setIsWeak(false);
        }
      };
      
      conn.addEventListener('change', updateConnectionStatus);
      updateConnectionStatus();

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        conn.removeEventListener('change', updateConnectionStatus);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isSyncing, setIsSyncing, isWeak };
}
