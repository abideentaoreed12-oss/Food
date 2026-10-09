import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';
import { Search, Plus, Star, Clock, Utensils, Store } from 'lucide-react';
import { MenuItem } from '../../types';

export const SearchPage: React.FC = () => {
  const {
    restaurants,
    selectedAddress,
    setSelectedRestaurantId,
    openCustomizer,
    addToCart,
    currency
  } = useDelivery();

  const [query, setQuery] = useState('');
  const [serverRestaurants, setServerRestaurants] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setServerRestaurants([]);
      setSearchError('');
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setSearchError('');
    const timer = setTimeout(async () => {
      try {
        const result: any = await api.restaurants.getAll({
          search: q,
          ...(selectedAddress?.address ? { address: selectedAddress.address } : {})
        });
        const list = Array.isArray(result) ? result : Array.isArray(result?.restaurants) ? result.restaurants : [];
        if (!cancelled) setServerRestaurants(list);
      } catch {
        if (!cancelled) {
          setServerRestaurants([]);
          setSearchError('Live search is temporarily unavailable. Showing matches from loaded menus.');
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedAddress?.address]);

  const searchableRestaurants = useMemo(() => {
    const byId = new Map<string, any>();
    [...(restaurants || []), ...serverRestaurants].forEach((restaurant: any) => {
      if (restaurant?.id) byId.set(restaurant.id, restaurant);
    });
    return Array.from(byId.values());
  }, [restaurants, serverRestaurants]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    searchableRestaurants.forEach((restaurant: any) => {
      (restaurant.categories || []).forEach((category: any) => {
        (category.items || []).forEach((item: any) => {
          if (item?.isAvailable !== false && item.name?.trim()) {
            const name = item.name.trim();
            counts.set(name, (counts.get(name) || 0) + 1);
          }
        });
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name]) => name);
  }, [searchableRestaurants]);

  // Collect all dishes across all restaurants safely
  const allDishes: { dish: MenuItem; restaurantName: string }[] = [];
  searchableRestaurants.forEach((r) => {
    if (!r) return;
    (r.categories || []).forEach((cat) => {
      if (!cat) return;
      (cat.items || []).forEach((item) => {
        if (!item || item.isAvailable === false) return;
        allDishes.push({ dish: { ...item, restaurantId: item.restaurantId || r.id, category: item.category || cat.name || '' }, restaurantName: r.name || 'Kitchen' });
      });
    });
  });

  const q = query.trim().toLowerCase();
  const matchingDishes = q
    ? allDishes.filter(
        (d) =>
          (d.dish?.name || '').toLowerCase().includes(q) ||
          (d.dish?.description || '').toLowerCase().includes(q) ||
          (d.dish?.category || '').toLowerCase().includes(q)
      )
    : [];

  const matchingRestaurants = q
    ? searchableRestaurants.filter(
        (r) =>
          r &&
          ((r.name || '').toLowerCase().includes(q) ||
            (r.cuisine || '').toLowerCase().includes(q) ||
            (r.tagline || '').toLowerCase().includes(q) ||
            (r.tags || []).some((t) => (t || '').toLowerCase().includes(q)))
      )
    : [];

  const handleAddDish = (dish: MenuItem) => {
    if (dish.restaurantId) setSelectedRestaurantId(dish.restaurantId);
    if (dish.customizations && dish.customizations.length > 0) {
      openCustomizer(dish);
    } else {
      addToCart(dish, 1, []);
    }
  };

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
          Search Dishes & Kitchens
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Find your favourite Nigerian meals, burgers, pizzas, and drinks
        </p>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for 'Jollof', 'Burger', 'Pizza'..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-xs"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Popular Trending Tags */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Trending Searches
        </div>
        <div className="flex flex-wrap gap-1.5">
          {trendingTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setQuery(tag)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-orange-50 hover:text-orange-600 transition-colors cursor-pointer"
            >
              {tag}
            </button>
          ))}
          {trendingTags.length === 0 && <p className="text-xs text-slate-400">Popular dishes appear when live menus are available.</p>}
        </div>
      </div>

      {/* Search Results */}
      {query.trim() === '' ? (
        <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 bg-white">
          <Utensils className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">What are you craving today?</p>
          <p className="text-xs text-slate-400 mt-1">
            Type any dish or restaurant name above to see live results.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {isSearching && <p className="text-xs text-slate-500">Searching live menus and kitchens…</p>}
          {searchError && <p className="text-xs text-amber-700">{searchError}</p>}
          {/* Matching Dishes */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-orange-600" />
              <span>Matching Dishes ({matchingDishes.length})</span>
            </h2>

            {matchingDishes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No dishes found matching "{query}".</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchingDishes.map(({ dish, restaurantName }) => (
                  <div
                    key={dish.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-orange-200 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {dish.name}
                        </h3>
                        <span className="text-xs font-bold text-orange-600 font-mono tabular-nums shrink-0">
                          {formatCurrency(dish.price, currency)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                        {dish.description}
                      </p>
                      <div className="text-[11px] font-semibold text-slate-400 mt-2 flex items-center gap-1">
                        <Store className="w-3 h-3 text-slate-400" />
                        <span>{restaurantName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddDish(dish)}
                      className="mt-3 w-full py-1.5 px-3 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{dish.customizations && dish.customizations.length > 0 ? 'Customize & Add' : 'Add to Cart'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Matching Restaurants */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-orange-600" />
              <span>Matching Kitchens ({matchingRestaurants.length})</span>
            </h2>

            {matchingRestaurants.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No kitchens found matching "{query}".</p>
            ) : (
              <div className="space-y-2.5">
                {matchingRestaurants.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRestaurantId(r.id)}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-orange-300 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{r.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <div className="flex items-center gap-1 text-slate-800">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="font-bold">{r.rating != null && Number.isFinite(Number(r.rating)) ? Number(r.rating).toFixed(1) : 'Not rated'}</span>
                        </div>
                        <span>·</span>
                        <span>{r.durationText || (r.deliveryTimeMin ? `${r.deliveryTimeMin} min` : 'Time unavailable')}</span>
                        <span>·</span>
                        <span className="text-orange-600 font-medium">{r.distanceText || (Number.isFinite(Number(r.distanceKm)) && Number(r.distanceKm) > 0 ? `${r.distanceKm} km` : 'Distance unavailable')}</span>
                        <span>·</span>
                        <span>{Number.isFinite(Number(r.calculatedDeliveryFee ?? r.deliveryFee)) ? `${formatCurrency(Number(r.calculatedDeliveryFee ?? r.deliveryFee), currency)} fee` : 'Fee unavailable'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                      View Menu
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
