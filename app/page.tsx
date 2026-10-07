'use client';

import { useState, useEffect } from 'react';
import App from '../src/App';

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#FF5500] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Loading Veyrang...</span>
        </div>
      </div>
    );
  }

  return <App />;
}
