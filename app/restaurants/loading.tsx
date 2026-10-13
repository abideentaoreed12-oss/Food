import React from 'react';

export default function RestaurantsLoading() {
  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20 px-4 sm:px-6 pt-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-200 rounded-xl" />
        <div className="h-4 w-96 max-w-full bg-slate-100 rounded-lg" />
      </div>

      <div className="h-12 w-full bg-slate-100 rounded-2xl border border-slate-200/60" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div key={idx} className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs space-y-3 p-4">
            <div className="w-full h-44 bg-slate-100 rounded-2xl" />
            <div className="h-5 w-3/4 bg-slate-200 rounded-lg" />
            <div className="h-4 w-1/2 bg-slate-100 rounded-lg" />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="h-4 w-20 bg-slate-100 rounded-md" />
              <div className="h-4 w-16 bg-slate-100 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
