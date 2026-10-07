import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';
import { Star, Clock, Search, Filter, Heart, ArrowUpDown, MapPin } from 'lucide-react';

export const RestaurantsPage: React.FC = () => {
  const {
    restaurants,
    setSelectedRestaurantId,
    currency,
    favourites,
    toggleFavourite,
    isFavourite
  } = useDelivery();

  const [query, setQuery] = useState('');
  const [filterFast, setFilterFast] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterLowFee, setFilterLowFee] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'time' | 'fee'>('rating');

  const restaurantImageMap: Record<string, string> = {
    'rest-1': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    'rest-2': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
    'rest-3': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=400&q=80',
    'rest-4': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80'
  };

  const safeRestaurants = restaurants || [];
  const filtered = safeRestaurants.filter((r) => {
    if (!r) return false;
    const nameStr = (r.name || '').toLowerCase();
    const cuisineStr = (r.cuisine || (r.tags && r.tags.join(' ')) || '').toLowerCase();
    const q = (query || '').toLowerCase().trim();
    const matchQuery = !q || nameStr.includes(q) || cuisineStr.includes(q);
    if (!matchQuery) return false;
    if (filterFast && (r.deliveryTimeMin || 30) > 30) return false;
    if (filterTopRated && (r.rating || 0) < 4.7) return false;
    if (filterLowFee && (r.deliveryFee || 0) > 500) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'time') return (a.deliveryTimeMin || 30) - (b.deliveryTimeMin || 30);
    if (sortBy === 'fee') return (a.deliveryFee || 0) - (b.deliveryFee || 0);
    return 0;
  });

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-5 pb-20">
      {/* Title */}
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
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-orange-500/20 shadow-2xs"
        />
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => setFilterFast(!filterFast)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterFast
              ? 'bg-[#FF5500] text-white border-[#FF5500]'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          ⚡ Under 30 mins
        </button>
        <button
          onClick={() => setFilterTopRated(!filterTopRated)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterTopRated
              ? 'bg-[#FF5500] text-white border-[#FF5500]'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          ★ 4.7+ Rating
        </button>
        <button
          onClick={() => setFilterLowFee(!filterLowFee)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
            filterLowFee
              ? 'bg-[#FF5500] text-white border-[#FF5500]'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
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

      {/* Restaurant Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((restaurant) => {
          const imageUrl =
            restaurantImageMap[restaurant.id] || restaurantImageMap['rest-1'];
          const fav = isFavourite(restaurant.id);

          return (
            <article
              key={restaurant.id}
              onClick={() => setSelectedRestaurantId(restaurant.id)}
              className="group relative rounded-3xl bg-white border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {restaurant.isOpen ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow-xs">
                        Open Now
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                        Closed
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavourite(restaurant.id);
                    }}
                    aria-label="Save to favourites"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 shadow-sm transition-colors cursor-pointer"
                  >
                    <Heart className={`w-4 h-4 ${fav ? 'text-rose-500 fill-rose-500' : ''}`} />
                  </button>

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-bold gap-1">
                    <span className="px-2 py-1 rounded-xl bg-black/60 backdrop-blur-md font-mono text-[11px]">
                      {restaurant.durationText || `${restaurant.deliveryTimeMin} mins`}
                    </span>
                    <span className="px-2 py-1 rounded-xl bg-orange-600/90 backdrop-blur-md font-mono text-[11px] flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {restaurant.distanceText || (restaurant.distanceKm ? `${restaurant.distanceKm} km` : 'Live Distance')}
                    </span>
                    <span className="px-2 py-1 rounded-xl bg-black/60 backdrop-blur-md font-mono text-[11px]">
                      {formatCurrency(restaurant.calculatedDeliveryFee || restaurant.deliveryFee, currency)}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-[#FF5500] transition-colors">
                      {restaurant.name}
                    </h2>
                    <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200/60 text-xs font-bold font-mono">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{restaurant.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {restaurant.cuisine}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-0 flex items-center justify-between text-xs font-bold text-[#FF5500]">
                <span>Browse Menu</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
