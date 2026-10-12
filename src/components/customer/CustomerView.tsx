import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../services/api';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { Restaurant, MenuItem } from '../../types';
import { formatCurrency } from '../../utils/format';
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
import { useRouter } from 'next/navigation';
import { ROUTES } from '../../routes';

export const CustomerView: React.FC = () => {
  const router = useRouter();
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
  const [activePromo, setActivePromo] = useState<{ code: string; discount_type: string; value: number; min_order?: number; max_cap?: number | null } | null>(null);

  useEffect(() => {
    api.settings.getPromos().then((res: any) => {
      const list = res?.data || res || [];
      if (Array.isArray(list) && list.length > 0) {
        setActivePromo(list[0]);
      } else {
        setActivePromo(null);
      }
    }).catch(() => {
      setActivePromo(null);
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const activeZoneConfig = (deliveryZones && deliveryZones.length > 0)
    ? (deliveryZones.find((z: any) => z.id === selectedZone || z.code === selectedZone) || deliveryZones[0])
    : null;

  const activeOrder = orders.find(
    (o) => o.status === 'in_transit' || o.status === 'preparing' || o.status === 'placed'
  );

  const [categories, setCategories] = useState<{ id: string; label: string; icon: any }[]>([]);

  useEffect(() => {
    api.admin.getCategories?.().then((res: any) => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      setCategories([
        { id: 'All', label: 'All', icon: LayoutGrid },
        ...list.map((c: any) => ({ id: c.name, label: c.name, icon: UtensilsCrossed }))
      ]);
    }).catch(() => {});
  }, []);

  const restaurantImageMap: Record<string, string> = {
    'rest-1': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    'rest-2': 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=400&q=80',
    'rest-3': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    'rest-4': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    'rest-5': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
    'rest-6': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80'
  };

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

  const filteredRestaurants = useMemo(() => {
    return (restaurants || []).filter((r) => {
      if (!r) return false;
      const tags = Array.isArray(r.tags) ? r.tags : [];
      const cuisine = r.cuisine || '';

      if (selectedCategory === 'Burgers' && !tags.includes('Burgers')) return false;
      if (selectedCategory === 'Pizza' && !tags.includes('Pizza')) return false;
      if (selectedCategory === 'Asian' && !tags.includes('Asian') && !cuisine.includes('Asian')) return false;
      if (selectedCategory === 'Healthy' && !tags.includes('Healthy')) return false;
      if (selectedCategory === 'Suya' && !tags.includes('Suya') && !tags.includes('Grills')) return false;
      if (selectedCategory === 'Nigerian' && !tags.includes('Nigerian') && !tags.includes('Jollof')) return false;

      if (activeFilter === 'fast' && (r.deliveryTimeMax || 30) > 30) return false;
      if (activeFilter === 'top' && (r.rating || 0) < 4.7) return false;
      if (activeFilter === 'lowFee' && (!Number.isFinite(Number(r.calculatedDeliveryFee)) || Number(r.calculatedDeliveryFee) > 500)) return false;

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
      {user && <WalletCard />}

      {activeOrder && (
        <div
          onClick={() => openTracking(activeOrder.id)}
          className="rounded-3xl bg-white border border-emerald-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-emerald-200 transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E8C547]/30 text-[#0D4F3C] px-2 py-0.5 rounded-full">
                  {activeOrder.status === 'in_transit' ? 'On the way' : 'Preparing in kitchen'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">#{activeOrder.shortId}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Estimated arrival:{' '}
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {activeOrder.estimatedArrivalMinutes == null
                    ? 'ETA unavailable'
                    : `${activeOrder.estimatedArrivalMinutes} min`}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[220px] sm:max-w-xs">
                ETA: {activeOrder.customerAddress || 'Address on file'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <span className="text-xs font-bold px-4 py-2 bg-[#0D4F3C] text-white rounded-full shadow-xs flex items-center gap-1">
              <span>Track Live</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search restaurants, jollof, burgers, pizza, suya, shawarma..."
            className="w-full h-12 bg-white border border-slate-200/90 rounded-2xl pl-11 pr-10 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#0D4F3C]/15 shadow-2xs transition-all"
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
                    ? 'bg-[#0D4F3C] text-white shadow-md shadow-emerald-900/20 ring-2 ring-emerald-700/20'
                    : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-[#E8F5EF]/40 hover:border-emerald-400'
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
                  ? 'bg-[#0D4F3C] text-white shadow-md shadow-emerald-900/20 ring-2 ring-emerald-700/20'
                  : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-[#E8F5EF]/40 hover:border-emerald-400'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl bg-linear-to-r from-[#0D4F3C] to-[#147A5A] p-4 text-white shadow-md shadow-emerald-900/12 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-100">
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
          onClick={activePromo ? handleApplyWelcomePromo : () => { setActivePage('offers'); router.push(ROUTES.OFFERS); }}
          className="text-xs font-bold px-4 py-2 bg-[#E8C547] text-[#0D4F3C] hover:bg-[#D4B23A] rounded-full shrink-0 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
        >
          {promoCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-emerald-800 font-bold">Applied!</span>
            </>
          ) : (
            <span>{activePromo ? 'Apply Code' : 'View Offers'}</span>
          )}
        </button>
      </div>

      {user && quickReorderItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0D4F3C]" />
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
                className="bg-white rounded-2xl border border-slate-200/80 p-2.5 shadow-2xs hover:shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between"
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
                    className="p-1.5 rounded-lg bg-[#E8F5EF] text-[#0D4F3C] hover:bg-[#0D4F3C] hover:text-white transition-colors cursor-pointer shadow-2xs"
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
                ? 'bg-[#0D4F3C] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>Under 30 mins</span>
          </button>
          <button
            onClick={() => setActiveFilter('top')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeFilter === 'top'
                ? 'bg-[#0D4F3C] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>Top Rated (4.7+)</span>
          </button>
          <button
            onClick={() => setActiveFilter('lowFee')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeFilter === 'lowFee'
                ? 'bg-[#0D4F3C] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>Low delivery fee</span>
          </button>
        </div>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">
            {searchQuery
              ? `Results for "${searchQuery}"`
              : selectedCategory === 'All'
              ? 'Popular Near You'
              : `${selectedCategory} Kitchens`}
          </h2>
          <button
            type="button"
            onClick={() => { setActivePage('restaurants'); router.push(ROUTES.RESTAURANTS); }}
            className="text-xs font-semibold text-[#0D4F3C] hover:underline"
          >
            See All
          </button>
        </div>

        {filteredRestaurants.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-600">No restaurants match your filters right now.</p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-[#0D4F3C] text-white rounded-xl text-xs font-semibold hover:bg-[#0A3F30] transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRestaurants.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRestaurantId(r.id)}
                className="group relative w-full text-left rounded-3xl bg-white border border-slate-200/80 p-3 sm:p-3.5 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer flex items-center gap-3.5 sm:gap-4"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={r.bannerUrl || (r as any).banner_r2_url || r.logoUrl || restaurantImageMap[r.id] || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80'}
                    alt={r.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#0D4F3C] transition-colors truncate">
                      {r.name}
                    </h3>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-slate-800 shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {(r.rating || 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{r.cuisine || 'Kitchen'}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {r.deliveryTimeMin != null && r.deliveryTimeMax != null
                        ? `${r.deliveryTimeMin}–${r.deliveryTimeMax} min`
                        : 'Delivery time unavailable'}
                    </span>
                    <span className="text-[#0D4F3C] font-medium flex items-center gap-0.5">
                      {Number.isFinite(Number(r.calculatedDeliveryFee))
                        ? formatCurrency(Number(r.calculatedDeliveryFee), currency)
                        : 'Fee after address'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
