'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';

const DeliveryMapView = dynamic(
  () => import('../map/DeliveryMapView').then((mod) => mod.DeliveryMapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] w-full rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-semibold animate-pulse border border-slate-200">
        Loading restaurant locations map...
      </div>
    )
  }
);
import {
  Star,
  Search,
  Filter,
  Heart,
  ArrowUpDown,
  Clock,
  MapPin,
  Utensils,
  Map as MapIcon,
  LayoutGrid,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface RestaurantListClientProps {
  initialRestaurants: any[];
}

function RestaurantQueryHandler() {
  const searchParams = useSearchParams();
  const { setSelectedRestaurantId } = useDelivery();

  useEffect(() => {
    const restaurantParam = searchParams.get('restaurant');
    if (restaurantParam) {
      setSelectedRestaurantId(restaurantParam);
    }
  }, [searchParams, setSelectedRestaurantId]);

  return null;
}

export const RestaurantListClient: React.FC<RestaurantListClientProps> = ({ initialRestaurants }) => {
  const {
    restaurants: contextRestaurants,
    setSelectedRestaurantId,
    currency,
    favourites,
    toggleFavourite,
    isFavourite
  } = useDelivery();

  // Prefer context restaurants if loaded, else use initialRestaurants from server
  const rawRestaurants =
    contextRestaurants && contextRestaurants.length > 0 ? contextRestaurants : initialRestaurants || [];

  const [query, setQuery] = useState('');
  const [filterFast, setFilterFast] = useState(false);
  const [filterTopRated, setFilterTopRated] = useState(false);
  const [filterLowFee, setFilterLowFee] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'time' | 'fee'>('rating');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  const filtered = rawRestaurants.filter((r) => {
    if (!r) return false;
    const nameStr = (r.name || '').toLowerCase();
    const cuisineStr = (r.cuisine || (r.tags && r.tags.join(' ')) || '').toLowerCase();
    const q = (query || '').toLowerCase().trim();
    const matchQuery = !q || nameStr.includes(q) || cuisineStr.includes(q);
    if (!matchQuery) return false;
    if (filterFast && (r.deliveryTimeMin || 30) > 30) return false;
    if (filterTopRated && (r.rating || 0) < 4.7) return false;
    if (filterLowFee && (!Number.isFinite(Number(r.calculatedDeliveryFee ?? r.deliveryFee)) || Number(r.calculatedDeliveryFee ?? r.deliveryFee) > 500)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'time') return (a.deliveryTimeMin || 30) - (b.deliveryTimeMin || 30);
    if (sortBy === 'fee') {
      const feeA = Number.isFinite(Number(a.calculatedDeliveryFee ?? a.deliveryFee)) ? Number(a.calculatedDeliveryFee ?? a.deliveryFee) : Number.POSITIVE_INFINITY;
      const feeB = Number.isFinite(Number(b.calculatedDeliveryFee ?? b.deliveryFee)) ? Number(b.calculatedDeliveryFee ?? b.deliveryFee) : Number.POSITIVE_INFINITY;
      return feeA - feeB;
    }
    return 0;
  });

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20 px-4 sm:px-6 pt-6">
      <Suspense fallback={null}>
        <RestaurantQueryHandler />
      </Suspense>

      {/* Header and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            All Partner Kitchens & Restaurants
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Explore trusted local kitchens, real-time menus, and on-demand delivery routes across your city.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'map'
                ? 'bg-white text-[#0D4F3C] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map View</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by restaurant name, cuisine, or specialty..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#0D4F3C]/20 shadow-2xs transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter and Sorting Row */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
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
          ₦ Low Delivery Fee
        </button>
        <div className="ml-auto flex items-center gap-1 shrink-0 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
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

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <DeliveryMapView
            height="480px"
            onSelectRestaurant={(id) => setSelectedRestaurantId(id)}
          />
          <p className="text-xs text-slate-500 text-center">
            Click on any restaurant pin to view menu details and place an order.
          </p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <>
          {sorted.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No restaurants match your filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your search terms or resetting active filter chips.
              </p>
              <button
                onClick={() => {
                  setQuery('');
                  setFilterFast(false);
                  setFilterTopRated(false);
                  setFilterLowFee(false);
                  setSortBy('rating');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-[#0D4F3C] text-white text-xs font-bold hover:bg-[#0A3F30] transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((restaurant) => {
                const imageUrl =
                  restaurant.bannerUrl ||
                  (restaurant as any).banner_r2_url ||
                  restaurant.imageUrl ||
                  restaurant.logoUrl ||
                  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
                const fav = isFavourite(restaurant.id);
                const isOpen = restaurant.isOpen !== false;
                const deliveryFee = restaurant.calculatedDeliveryFee ?? restaurant.deliveryFee;
                const formattedFee =
                  Number.isFinite(Number(deliveryFee)) && Number(deliveryFee) > 0
                    ? formatCurrency(Number(deliveryFee), currency)
                    : 'Free Delivery';
                const estTime = restaurant.deliveryTimeMin ? `${restaurant.deliveryTimeMin} mins` : '25-35 mins';

                return (
                  <article
                    key={restaurant.id}
                    onClick={() => setSelectedRestaurantId(restaurant.id)}
                    className="group relative rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-2xs hover:shadow-md hover:border-[#0D4F3C]/40 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Image Header */}
                      <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                        <img
                          src={imageUrl}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Open / Closed Badge */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          {isOpen ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow-xs">
                              Open Now
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                              Closed
                            </span>
                          )}
                        </div>

                        {/* Favorite Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavourite(restaurant.id);
                          }}
                          aria-label="Save to favourites"
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-rose-500 shadow-xs transition-colors cursor-pointer"
                        >
                          <Heart className={`w-4 h-4 ${fav ? 'text-rose-500 fill-rose-500' : ''}`} />
                        </button>

                        {/* Fast Time Badge */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-bold text-white bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-xl">
                          <Clock className="w-3 h-3 text-[#E8C547]" />
                          <span>{estTime}</span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-base font-bold text-slate-900 group-hover:text-[#0D4F3C] transition-colors line-clamp-1">
                              {restaurant.name}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium line-clamp-1">
                              {restaurant.cuisine || 'Local Kitchen & Grills'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200/60 text-xs font-bold font-mono shrink-0">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>{restaurant.rating || '4.8'}</span>
                          </div>
                        </div>

                        {restaurant.address && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{restaurant.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 pt-0 border-t border-slate-100/80 flex items-center justify-between gap-2 mt-2">
                      <div className="text-xs font-bold text-slate-700">
                        <span className="text-[10px] text-slate-400 block font-normal">Delivery</span>
                        {formattedFee}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/restaurants/${encodeURIComponent(restaurant.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 text-xs font-semibold text-slate-500 hover:text-[#0D4F3C] hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1"
                          title="View Restaurant Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRestaurantId(restaurant.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0D4F3C] text-white text-xs font-bold hover:bg-[#0A3F30] transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>Order Now</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
