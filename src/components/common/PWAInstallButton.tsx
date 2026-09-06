import React, { useState } from 'react';
import { Download, Share2, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-xs">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Installed</span>
      </div>
    );
  }

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          aria-label="Install LESCO Energy Manager on device"
          className={`flex items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold shadow-xs transition ${
            compact ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {isIOS && (
        <button
          onClick={() => setShowIOSGuide(true)}
          aria-label="How to install on iOS"
          className="flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 px-3 py-1 text-xs text-slate-700 font-bold transition"
        >
          <Share2 className="w-3.5 h-3.5 text-blue-600" />
          <span>Install (iOS)</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  PWA
                </div>
                <h3 className="text-sm font-bold text-slate-900">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                  1
                </span>
                <p>
                  Tap the <strong className="text-slate-900">Share</strong> icon in the Safari toolbar at the bottom or top of your screen.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                  2
                </span>
                <p>
                  Scroll down the share sheet and tap <strong className="text-slate-900">Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                  3
                </span>
                <p>
                  Launch from your home screen for high-speed offline utility access with full screen space.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-full bg-slate-900 hover:bg-slate-800 py-3 text-xs font-bold text-white transition shadow-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
