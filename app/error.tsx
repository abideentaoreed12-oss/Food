'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    (error?.message && (error.message.includes('Loading chunk') || error.message.includes('ChunkLoadError')));

  useEffect(() => {
    console.error('App error caught by Next.js error boundary:', error);
    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = 'chunk_reload_' + Date.now();
      const lastReload = sessionStorage.getItem('last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('last_chunk_reload', now.toString());
        window.location.reload();
      }
    }
  }, [error, isChunkError]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md text-center space-y-4 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">Application Notice</h2>
        <p className="text-xs text-slate-500">
          {isChunkError
            ? 'A new version of the application was updated. Please refresh to load the latest release.'
            : (error?.message || 'An unexpected condition occurred.')}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              if (isChunkError && typeof window !== 'undefined') {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
          >
            {isChunkError ? 'Refresh Application' : 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
}
