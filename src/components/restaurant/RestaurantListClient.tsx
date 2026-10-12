'use client';
import React, { useState } from 'react';
import { formatCurrency } from '../../utils/format';
import { Star, Search, Filter, Heart, ArrowUpDown } from 'lucide-react';

export const RestaurantListClient: React.FC<{ initialRestaurants: any[] }> = ({ initialRestaurants }) => {
  const [restaurants] = useState(initialRestaurants);
  const [query, setQuery] = useState('');
  const [filterFast, setFilterFast] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterLowFee, setFilterLowFee] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'time' | 'fee'>('rating');

  const filtered = restaurants.filter((r) => {
    if (!r) return false;
    const nameStr = (r.name || '').toLowerCase();
    const cuisineStr = (r.cuisine || (r.tags && r.tags.join(' ')) || '').toLowerCase();
    const q = (query || '').toLowerCase().trim();
    const matchQuery = !q || nameStr.includes(q) || cuisineStr.includes(q);
    if (!matchQuery) return false;
    if (filterFast && (r.deliveryTimeMin || 30) > 30) return false;
    if (filterTopRated && (r.rating || 0) < 4.7) return false;
    if (filterLowFee && (!Number.isFinite(Number(r.calculatedDeliveryFee)) || Number(r.calculatedDeliveryFee) > 500)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'time') return (a.deliveryTimeMin || 30) - (b.deliveryTimeMin || 30);
    if (sortBy === 'fee') return (Number.isFinite(Number(a.calculatedDeliveryFee)) ? Number(a.calculatedDeliveryFee) : Number.POSITIVE_INFINITY) - (Number.isFinite(Number(b.calculatedDeliveryFee)) ? Number(b.calculatedDeliveryFee) : Number.POSITIVE_INFINITY);
    return 0;
  });

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          All Restaurants
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Order from trusted local kitchens across your city
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by restaurant or cuisine..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#0D4F3C]/20 shadow-2xs"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => setFilterFast(!filterFast)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterFast ? 'bg-[#0D4F3C] text-white border-[#0D4F3C]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          ⚡ Under 30 mins
        </button>
        <button
          onClick={() => setFilterTopRated(!filterTopRated)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterTopRated ? 'bg-[#0D4F3C] text-white border-[#0D4F3C]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          ★ 4.7+ Rating
        </button>
        <button
          onClick={() => setFilterLowFee(!filterLowFee)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterLowFee ? 'bg-[#0D4F3C] text-white border-[#0D4F3C]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          ₦ Low Fee (≤ ₦500)
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-xl px-2 py-1">
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="rating">Top Rated</option>
            <option value="time">Fastest Delivery</option>
            <option value="fee">Lowest Delivery Fee</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No restaurants match your filters</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((restaurant) => {
            const imageUrl = restaurant.bannerUrl || restaurant.logoUrl || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
            return (
              <article
                key={restaurant.id}
                className="group relative rounded-3xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md hover:border-[#0D4F3C]/40 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={restaurant.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0D4F3C] transition-colors">{restaurant.name}</h2>
                    <p className="text-xs text-slate-500 font-medium">{restaurant.cuisine}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
