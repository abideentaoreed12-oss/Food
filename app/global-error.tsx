'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-[#F8F9FA] text-slate-900">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md text-center space-y-4 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Application Notice</h2>
            <p className="text-xs text-slate-500">{error?.message || 'An unexpected condition occurred.'}</p>
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-[#FF5500] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Reload Platform
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
