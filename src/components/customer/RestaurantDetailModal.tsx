import React, { useState, useEffect } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { MenuItem } from '../../types';
import { formatCurrency } from '../../utils/format';
import {
  X,
  Star,
  Clock,
  MapPin,
  Search,
  Plus,
  ShoppingBag,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';

export const RestaurantDetailModal: React.FC = () => {
  const {
    restaurants,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedAddress,
    openCustomizer,
    addToCart,
    cart,
    setIsCartOpen,
    currency
  } = useDelivery();

  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveMetrics, setLiveMetrics] = useState<{
    distanceKm: number;
    distanceText: string;
    durationText: string;
    estimatedDeliveryFee: number;
  } | null>(null);

  const restaurant = restaurants.find((r) => r.id === selectedRestaurantId);

  useEffect(() => {
    if (!selectedRestaurantId || !restaurant) return;
    const activeAddr = selectedAddress?.address || user?.address || '';

    let isMounted = true;
    api.restaurants
      .calculateDistance({
        restaurantId: selectedRestaurantId,
        userAddress: activeAddr
      })
      .then((res: any) => {
        if (isMounted && res) {
          setLiveMetrics({
            distanceKm: res.distanceKm,
            distanceText: res.distanceText,
            durationText: res.durationText,
            estimatedDeliveryFee: res.estimatedDeliveryFee
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [selectedRestaurantId, user?.address, selectedAddress?.address]);
  if (!restaurant) return null;

  const allItems: MenuItem[] = (restaurant.categories || []).flatMap((cat) => cat?.items || []);

  const filteredItems = allItems.filter((item) => {
    if (!item) return false;
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const nameStr = (item.name || '').toLowerCase();
    const descStr = (item.description || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || nameStr.includes(q) || descStr.includes(q);
    return matchesCat && matchesSearch;
  });

  const cartItemsForThis = cart.filter(
    (item) => item?.menuItem?.restaurantId === restaurant.id
  );
  const cartCount = cartItemsForThis.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItemsForThis.reduce((s, i) => s + i.itemTotal, 0);

  const handleAddItem = (item: MenuItem) => {
    if (!item.isAvailable || restaurant.isBusyPaused) return;

    if (item.customizations && item.customizations.length > 0) {
      openCustomizer(item);
    } else {
      addToCart(item, 1, []);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Restaurant Header */}
        <div className="relative p-5 sm:p-6 border-b border-slate-100 bg-linear-to-b from-orange-50/60 to-white">
          <button
            onClick={() => setSelectedRestaurantId(null)}
            aria-label="Close restaurant menu"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors shadow-xs flex items-center justify-center cursor-pointer z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pr-10">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                {restaurant.cuisine || restaurant.tags?.[0] || 'Kitchen'}
              </span>
              {restaurant.isBusyPaused ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Kitchen Busy (Orders Paused)
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Open Now
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
              {restaurant.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{restaurant.tagline || ''}</p>

            {/* Quick Metadata Bar */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-200/60">
              <div className="flex items-center gap-1 font-bold text-slate-900">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span className="font-mono tabular-nums">
                  {(restaurant.rating != null ? Number(restaurant.rating) : 4.5).toFixed(1)}
                </span>
                <span className="text-slate-400 font-normal">({restaurant.reviewCount || 0}+)</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{liveMetrics?.durationText || restaurant.durationText || `${restaurant.deliveryTimeMin}–${restaurant.deliveryTimeMax} min`}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1 text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/60">
                <MapPin className="w-3.5 h-3.5" />
                <span>{liveMetrics?.distanceText || restaurant.distanceText || (restaurant.distanceKm ? `${restaurant.distanceKm} km away` : 'Live Distance')}</span>
              </div>
              <span>·</span>
              <div className="text-slate-700 font-medium">
                {formatCurrency(liveMetrics?.estimatedDeliveryFee || restaurant.calculatedDeliveryFee || restaurant.deliveryFee, currency)} delivery
              </div>
              <span>·</span>
              <div className="text-slate-500">
                Min. order {formatCurrency(restaurant.minOrder, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Category Anchor Filter & Search */}
        <div className="p-3 border-b border-slate-100 bg-white space-y-2">
          {/* Search inside menu */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes in menu..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Categories Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            {restaurant.categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.name
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No menu items match your search.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  !item.isAvailable
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-200 hover:border-orange-200 shadow-2xs'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                    {item.popular && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 bg-orange-100 text-orange-700 rounded">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-2 text-sm font-bold text-orange-600 font-mono tabular-nums">
                    {formatCurrency(item.price, currency)}
                  </div>
                </div>

                {/* Add / Sold Out Button */}
                <div className="shrink-0 flex items-center">
                  {!item.isAvailable ? (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold">
                      Sold Out
                    </span>
                  ) : (() => {
                    const itemCountInCart = cart
                      .filter((ci) => ci.menuItem?.id === item.id)
                      .reduce((sum, ci) => sum + ci.quantity, 0);

                    return (
                      <button
                        onClick={() => handleAddItem(item)}
                        aria-label={`Add ${item.name} to cart`}
                        className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                        {itemCountInCart > 0 && (
                          <span className="ml-1 px-1.5 py-0.2 bg-white text-orange-600 rounded-md font-mono text-[10px] font-extrabold shadow-2xs">
                            {itemCountInCart}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky Cart CTA Bar (Section C of user prompt: [ View cart · 2 items · ₦7,700 ]) */}
        {cartCount > 0 && (
          <div className="p-3.5 border-t border-slate-100 bg-white">
            <button
              onClick={() => {
                setIsCartOpen(true);
                setSelectedRestaurantId(null);
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-md shadow-orange-600/20 cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span>View cart · {cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="flex items-center gap-1 font-mono tabular-nums">
                <span>{formatCurrency(cartTotal, currency)}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
