import React from 'react';
import { WifiOff, RefreshCcw, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function ConnectionBanner() {
  const { isOnline, isSyncing, isWeak } = useNetworkStatus();

  if (isOnline && !isSyncing && !isWeak) return null;

  return (
    <div className={`fixed top-0 left-0 w-full z-50 flex items-center justify-center p-2 text-sm font-medium transition-colors ${!isOnline ? 'bg-red-500 text-white' : isSyncing ? 'bg-blue-500 text-white' : isWeak ? 'bg-yellow-500 text-black' : ''}`}>
      {!isOnline && (
        <>
          <WifiOff size={16} className="mr-2" />
          You are offline. Waiting for network...
        </>
      )}
      {isOnline && isWeak && (
        <>
          <AlertTriangle size={16} className="mr-2" />
          Weak connection. App may be slow.
        </>
      )}
      {isOnline && isSyncing && !isWeak && (
        <>
          <RefreshCcw size={16} className="mr-2 animate-spin" />
          Syncing pending actions...
        </>
      )}
    </div>
  );
}
