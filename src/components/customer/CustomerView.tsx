import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../services/api';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { Restaurant, MenuItem } from '../../types';
import { formatCurrency, DELIVERY_ZONES } from '../../utils/format';
import { WalletCard } from './WalletCard';
import {
  Star,
  Clock,
  LayoutGrid,
  Heart,
  ChevronRight,
  Flame,
  Soup,
  Leaf,
  Pizza,
  UtensilsCrossed,
  Tag,
  Search,
  X,
  Wallet,
  MapPin,
  Plus,
  Check,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const CustomerView: React.FC = () => {
  const {
    restaurants,
    setSelectedRestaurantId,
    orders,
    openTracking,
    currency,
    favourites,
    toggleFavourite,
    isFavourite,
    setActivePage,
    walletBalanceNGN,
    setIsWalletModalOpen,
    selectedZone,
    setSelectedZone,
    appliedPromo,
    applyPromoCode,
    addToCart,
    platformSettings,
    deliveryZones
  } = useDelivery();

  const { user, setIsAuthModalOpen } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'fast' | 'top' | 'lowFee'>('all');
  const [promoCopied, setPromoCopied] = useState(false);
  const [activePromo, setActivePromo] = useState<{ id: string; code: string; discount_type: string; value: number; min_order_amount: number; max_discount_cap: number } | null>(null);

  useEffect(() => {
    api.settings.getPromos().then((res: any) => {
      const list = res?.data || res || [];
      if (Array.isArray(list) && list.length > 0) {
        // Grab the first active promo
        setActivePromo(list[0]);
      } else {
        setActivePromo(null);
      }
    }).catch(() => {
      setActivePromo(null);
    });
  }, []);

  // Time-of-day personalized greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const activeZoneConfig = (deliveryZones && deliveryZones.length > 0)
    ? (deliveryZones.find((z: any) => z.id === selectedZone || z.code === selectedZone) || deliveryZones[0])
    : (DELIVERY_ZONES.find((z) => z.id === selectedZone) || DELIVERY_ZONES[0]);

  // Active in-transit or preparing order
  const activeOrder = orders.find(
    (o) => o.status === 'in_transit' || o.status === 'preparing' || o.status === 'placed'
  );

  const categories = [
    { id: 'All', label: 'All', icon: LayoutGrid },
    { id: 'Burgers', label: 'Burgers', icon: UtensilsCrossed },
    { id: 'Pizza', label: 'Pizza', icon: Pizza },
    { id: 'Asian', label: 'Asian', icon: Soup },
    { id: 'Healthy', label: 'Healthy', icon: Leaf },
    { id: 'Suya', label: 'Suya & BBQ', icon: Flame },
    { id: 'Nigerian', label: 'Naija Kitchen', icon: Soup }
  ];

  // Food images map for each restaurant
  const restaurantImageMap: Record<string, string> = {
    'rest-1': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80', // Burger House
    'rest-2': 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=400&q=80', // Italiano Pizza
    'rest-3': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80', // Naija Kitchen
    'rest-4': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80', // Suya Express
    'rest-5': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80', // The Good Bowl
    'rest-6': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80'  // Tokyo Wok
  };

  // Quick re-order favorite dishes for logged-in users
  const quickReorderItems: {
    item: MenuItem;
    restaurantName: string;
    imageUrl: string;
  }[] = useMemo(() => {
    const list: { item: MenuItem; restaurantName: string; imageUrl: string }[] = [];
    (restaurants || []).forEach((r) => {
      if (r && Array.isArray(r.categories) && r.categories.length > 0 && Array.isArray(r.categories[0]?.items) && r.categories[0].items.length > 0) {
        list.push({
          item: r.categories[0].items[0],
          restaurantName: r.name || 'Restaurant',
          imageUrl: r.bannerUrl || (r as any).banner_r2_url || r.logoUrl || restaurantImageMap[r.id] || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80'
        });
      }
    });
    return list.slice(0, 4);
  }, [restaurants]);

  // Filter restaurants by category, search text, and filter pills
  const filteredRestaurants = useMemo(() => {
    return (restaurants || []).filter((r) => {
      if (!r) return false;
      const tags = Array.isArray(r.tags) ? r.tags : [];
      const cuisine = r.cuisine || '';

      // Category filter
      if (selectedCategory === 'Burgers' && !tags.includes('Burgers')) return false;
      if (selectedCategory === 'Pizza' && !tags.includes('Pizza')) return false;
      if (selectedCategory === 'Asian' && !tags.includes('Asian') && !cuisine.includes('Asian')) return false;
      if (selectedCategory === 'Healthy' && !tags.includes('Healthy')) return false;
      if (selectedCategory === 'Suya' && !tags.includes('Suya') && !tags.includes('Grills')) return false;
      if (selectedCategory === 'Nigerian' && !tags.includes('Nigerian') && !tags.includes('Jollof')) return false;

      // Filter pills
      if (activeFilter === 'fast' && (r.deliveryTimeMax || 30) > 30) return false;
      if (activeFilter === 'top' && (r.rating || 0) < 4.7) return false;
      if (activeFilter === 'lowFee' && (r.deliveryFee || 0) > 500) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (r.name || '').toLowerCase().includes(query);
        const matchesCuisine = cuisine.toLowerCase().includes(query);
        const matchesTags = tags.some((t) => (t || '').toLowerCase().includes(query));
        const matchesItems = Array.isArray(r.categories) && r.categories.some((c) =>
          Array.isArray(c?.items) && c.items.some((i) => (i?.name || '').toLowerCase().includes(query) || (i?.description || '').toLowerCase().includes(query))
        );
        return matchesName || matchesCuisine || matchesTags || Boolean(matchesItems);
      }

      return true;
    });
  }, [restaurants, selectedCategory, activeFilter, searchQuery]);

  const handleApplyWelcomePromo = async () => {
    if (activePromo?.code) {
      await applyPromoCode(activePromo.code);
      setPromoCopied(true);
      setTimeout(() => setPromoCopied(false), 3000);
    }
  };

  const handleQuickAdd = (item: MenuItem) => {
    addToCart(item, 1, []);
  };

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      {/* Veyrang Wallet Card (Matching exact reference IMG_5190.jpeg) */}
      {user && <WalletCard />}

      {/* Active Order Live Banner if any (Prominent and Honest Tracking) */}
      {activeOrder && (
        <div
          onClick={() => openTracking(activeOrder.id)}
          className="rounded-3xl bg-linear-to-r from-orange-500 via-[#FF5500] to-amber-500 text-white p-4 shadow-md shadow-orange-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md text-white">
                  {activeOrder.status === 'in_transit' ? '🛵 On the way' : '👨‍🍳 Preparing in kitchen'}
                </span>
                <span className="text-xs font-mono font-bold text-orange-100">{activeOrder.shortId}</span>
              </div>
              <p className="text-xs text-white/90 font-medium mt-1">
                Estimated arrival: <span className="font-bold font-mono text-white text-sm">{activeOrder.estimatedArrivalMinutes} min ETA</span>
                {' · '}{activeOrder.customerAddress}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-xs font-bold px-3 py-1.5 bg-white text-[#FF5500] rounded-xl shadow-xs flex items-center gap-1">
              <span>Track Live</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      )}

      {/* Quick Search Bar directly on Home */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search restaurants, jollof, burgers, pizza, suya, shawarma..."
            className="w-full h-12 bg-white border border-slate-200/90 rounded-2xl pl-11 pr-10 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-2 focus:ring-[#FF5500]/15 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Pills (Exact layout from uploaded reference IMG_5185.jpeg) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;

          if (cat.id === 'All') {
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory('All')}
                aria-label="All Categories"
                className={`flex items-center justify-center w-12 h-11 rounded-2xl transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#FF5500] text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/20'
                    : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-[#FFF1E8]/40 hover:border-orange-300'
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          }

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 h-11 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isSelected
                  ? 'bg-[#FF5500] text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-500/20'
                  : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-[#FFF1E8]/40 hover:border-orange-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Promotional Banner Callout */}
      <div className="rounded-3xl bg-linear-to-r from-[#FF5500] to-amber-500 p-4 text-white shadow-md shadow-orange-500/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-orange-100">
              {activePromo ? 'Featured Offer' : (platformSettings?.cms_storefront_promo_badge || 'Veyrang Feasts')}
            </div>
            <div className="text-sm font-bold">
              {activePromo ? (
                activePromo.discount_type === 'percentage'
                  ? `Use code ${activePromo.code} for ${activePromo.value}% off your order!`
                  : `Use code ${activePromo.code} for ₦${Number(activePromo.value).toLocaleString('en-NG')} off your order!`
              ) : (
                platformSettings?.cms_storefront_promo_text || 'Check our Offers page for verified food coupons & seasonal discounts!'
              )}
            </div>
          </div>
        </div>
        <button
          onClick={activePromo ? handleApplyWelcomePromo : () => setActivePage('offers')}
          className="text-xs font-bold px-3 py-1.5 bg-white text-[#FF5500] hover:bg-orange-50 rounded-xl shrink-0 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
        >
          {promoCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Applied!</span>
            </>
          ) : (
            <span>{activePromo ? 'Apply Code' : 'View Offers'}</span>
          )}
        </button>
      </div>

      {/* Order Again / Quick Reorder (Only for Logged-In Users or Frequent Eaters) */}
      {user && quickReorderItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
                Order Again
              </h2>
            </div>
            <span className="text-xs text-slate-400">1-tap reorder</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickReorderItems.map(({ item, restaurantName, imageUrl }) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-2xs hover:shadow-sm hover:border-orange-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-100 mb-2">
                    <img
                      src={imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">{item.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{restaurantName}</p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold font-mono text-slate-900">
                    {formatCurrency(item.price, currency)}
                  </span>
                  <button
                    onClick={() => handleQuickAdd(item)}
                    className="p-1.5 rounded-lg bg-[#FFF1E8] text-[#FF5500] hover:bg-[#FF5500] hover:text-white transition-colors cursor-pointer shadow-2xs"
                    title="Add to cart"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter Chips Bar (Fastest, Top Rated, Low Fee) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Places
          </button>
          <button
            onClick={() => setActiveFilter('fast')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeFilter === 'fast'
                ? 'bg-[#FF5500] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>⚡ Under 30 mins</span>
          </button>
          <button
            onClick={() => setActiveFilter('top')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeFilter === 'top'
                ? 'bg-[#FF5500] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>⭐ Top Rated (4.7+)</span>
          </button>
          <button
            onClick={() => setActiveFilter('lowFee')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeFilter === 'lowFee'
                ? 'bg-[#FF5500] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🏷️ ₦500 Delivery Fee</span>
          </button>
        </div>
      </div>

      {/* Restaurant List Section (Matches IMG_5185.jpeg reference) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
            {searchQuery
              ? `Results for "${searchQuery}"`
              : selectedCategory === 'All'
              ? 'Popular Near You'
              : `${selectedCategory} Kitchens`}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {filteredRestaurants.length} {filteredRestaurants.length === 1 ? 'place' : 'places'}
          </span>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 bg-white">
            <p className="text-sm font-semibold text-slate-800">No restaurants match your selection</p>
            <p className="text-xs text-slate-500 mt-1">
              Try searching for something else or reset the category filter.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
                setActiveFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-[#FF5500] text-white rounded-xl text-xs font-semibold hover:bg-[#EA4C00] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredRestaurants.map((restaurant) => {
            const imageUrl =
              restaurant.bannerUrl ||
                (restaurant as any).banner_r2_url ||
                restaurant.logoUrl ||
                restaurantImageMap[restaurant.id] ||
                'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
              const isFav = isFavourite(restaurant.id);

              return (
                <article
                  key={restaurant.id}
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                  className="group relative rounded-3xl bg-white border border-slate-200/80 p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-orange-300 transition-all cursor-pointer flex items-center gap-3.5 sm:gap-4"
                >
                  {/* Left Food Image Thumbnail */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-slate-100">
                    <img
                      src={imageUrl}
                      alt={restaurant.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {restaurant.badge && (
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs">
                        {restaurant.badge}
                      </span>
                    )}
                  </div>

                  {/* Right Details (Exact structure from mockup) */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#FF5500] transition-colors truncate">
                        {restaurant.name}
                      </h3>
                    </div>

                    {/* Rating row: ★ 4.6 (320) */}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-700">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {(restaurant.rating != null ? Number(restaurant.rating) : 4.5).toFixed(1)}
                      </span>
                      <span className="text-slate-400 font-mono">
                        ({restaurant.reviewCount || 0})
                      </span>
                      <span className="text-slate-300 font-bold">·</span>
                      <span className="text-slate-500 truncate text-[11px] sm:text-xs">
                        {restaurant.cuisine || restaurant.tags?.[0] || 'Kitchen'}
                      </span>
                    </div>

                    {/* Delivery Time, Distance & Fee row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono tabular-nums">
                        {restaurant.durationText || `${restaurant.deliveryTimeMin}–${restaurant.deliveryTimeMax} min`}
                      </span>
                      <span>·</span>
                      <span className="text-orange-600 font-medium flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{restaurant.distanceText || (restaurant.distanceKm ? `${restaurant.distanceKm} km` : 'Live Distance')}</span>
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(restaurant.calculatedDeliveryFee || restaurant.deliveryFee, currency)} fee
                      </span>
                    </div>

                    {/* Minimum order note */}
                    <div className="mt-1 text-[11px] text-slate-400">
                      Min. order {formatCurrency(restaurant.minOrder, currency)}
                    </div>
                  </div>

                  {/* Favorite toggle button (top right of card) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavourite(restaurant.id);
                    }}
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer text-slate-400 hover:text-red-500"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isFav ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                  </button>
                </article>
              );
            })
          )}
        </div>
      </div>
  );
};
