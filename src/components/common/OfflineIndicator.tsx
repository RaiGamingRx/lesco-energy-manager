import React, { useState, useEffect } from 'react';
import { WifiOff, Database } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto sm:right-auto sm:left-6 flex items-center justify-between gap-3 rounded-2xl bg-white/95 border border-amber-300 px-4 py-3 text-xs text-slate-900 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
        <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
        <div>
          <span className="font-bold text-slate-900">Offline Mode Active</span>
          <p className="text-[11px] text-slate-500">All meter records save safely to local browser storage.</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-mono font-bold">
        <Database className="w-3.5 h-3.5" />
        <span>Stored</span>
      </div>
    </div>
  );
};
