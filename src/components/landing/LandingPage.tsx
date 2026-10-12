import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { DELIVERY_ZONES, formatCurrency } from '../../utils/format';
import { DeliveryZone, UserRole } from '../../types';
import {
  MapPin,
  Clock,
  ShieldCheck,
  Wallet,
  ShoppingBag,
  ArrowRight,
  Star,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  PhoneCall,
  ChevronRight,
  Flame,
  Soup,
  Pizza,
  Tag,
  UtensilsCrossed,
  ChefHat,
  Bike,
  ShieldAlert,
  ExternalLink,
  MessageSquare,
  Truck,
  Utensils,
  ChevronDown
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const {
    setActivePage,
    setActiveRole,
    selectedZone,
    setSelectedZone,
    restaurants,
    setSelectedRestaurantId,
    currency,
    deliveryZones,
    platformSettings
  } = useDelivery();

  const { setIsAuthModalOpen } = useAuth();

  const activeZoneConfig = (deliveryZones && deliveryZones.length > 0)
    ? (deliveryZones.find((z: any) => z.id === selectedZone || z.code === selectedZone) || deliveryZones[0])
    : null;

  const handleExploreStorefront = () => {
    setActiveRole('customer');
    setActivePage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeFee = activeZoneConfig?.base_delivery_fee ?? activeZoneConfig?.deliveryFee;
  const activeFeeText = (activeFee !== undefined && activeFee !== null && Number.isFinite(Number(activeFee)))
    ? ` - ₦${Number(activeFee).toLocaleString('en-NG')} Fee`
    : '';
  const activeZoneDisplay = activeZoneConfig
    ? `${activeZoneConfig.name}${activeZoneConfig.city ? ` (${activeZoneConfig.city})` : ''}${activeFeeText}`
    : 'Select Delivery Zone';

  // Extract real menu items from actual restaurants loaded from D1
  const realFeaturedDishes = React.useMemo(() => {
    const list: { item: any; restaurant: any }[] = [];
    (restaurants || []).forEach((r) => {
      (r.categories || []).forEach((c: any) => {
        (c.items || []).forEach((item: any) => {
          list.push({ item, restaurant: r });
        });
      });
    });
    return list;
  }, [restaurants]);

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-slate-900 flex flex-col font-sans selection:bg-[#0D4F3C] selection:text-white pb-24 sm:pb-16">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION (RICH FOREST GREEN WITH HIGH-FIDELITY DISH)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0D4F3C] via-[#0A4333] to-[#08382B] text-white pt-6 sm:pt-12 pb-12 sm:pb-20">
        {/* Subtle ambient lighting / texture */}
        <div className="absolute -top-16 -right-16 w-80 h-80 sm:w-96 sm:h-96 bg-radial from-[#188B67]/25 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 items-center">
            {/* Copy / Tag Area */}
            <div className="w-full md:col-span-7 space-y-3 sm:space-y-4 text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#147A5A]/50 border border-[#20B486]/40 text-emerald-100 text-xs font-semibold backdrop-blur-xs">
                <Utensils className="w-3.5 h-3.5 text-[#E8C547]" />
                <span className="truncate max-w-[260px] sm:max-w-none">{platformSettings['cms_hero_badge'] || 'Global Express Food & Cloud Kitchen Network'}</span>
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold font-display tracking-tight leading-[1.18]">
                <span className="block text-white">Hot, Delicious Meals</span>
                <span className="block text-[#E8C547]">Delivered to Your Door</span>
                <span className="block text-white">in 25 Minutes.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm text-emerald-100/85 max-w-xl leading-relaxed">
                {platformSettings['cms_hero_subtitle'] || 'Order authentic specialties, artisanal pizzas, gourmet burgers, and delicious dishes from top-rated restaurants across your city. Verified kitchen tracking, 4-digit handover PIN protection, and zero payment failures with your in-app Naira wallet.'}
              </p>
            </div>

            {/* Dish Visual */}
            <div className="w-full md:col-span-5 flex justify-center md:justify-end">
              <div className="relative w-40 h-40 sm:w-56 sm:h-56 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full overflow-hidden shadow-2xl border-2 sm:border-4 border-[#147A5A]/60 ring-2 sm:ring-4 ring-[#E8C547]/25 shrink-0">
                <img
                  src="/hero_jollof_bowl.jpg"
                  alt="Authentic Nigerian Jollof Rice with grilled chicken and fried plantains"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative subtle wavy bottom separator */}
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. FLOATING DELIVERY ZONE CARD (OVERLAPPING HERO BOUNDARY)
      ───────────────────────────────────────────────────────────── */}
      <div className="-mt-6 sm:-mt-8 relative z-20 px-4 max-w-xl mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/10 border border-slate-100 p-3.5 sm:p-5 space-y-2.5 sm:space-y-3">
          {/* Zone Selector Box */}
          <div className="relative flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  YOUR DELIVERY ZONE
                </span>
                <span className="block text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {activeZoneDisplay}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-700 stroke-[2.5] shrink-0 ml-2" />
            <select
              value={selectedZone || ''}
              onChange={(e) => setSelectedZone(e.target.value as DeliveryZone)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Select delivery zone"
            >
              {deliveryZones && deliveryZones.length > 0 ? (
                deliveryZones.map((zone: any) => {
                  const zoneId = zone.id || zone.code;
                  const fee = zone.base_delivery_fee ?? zone.deliveryFee;
                  const feeText = (fee !== undefined && fee !== null && Number.isFinite(Number(fee)))
                    ? ` - ₦${Number(fee).toLocaleString('en-NG')} Fee`
                    : '';
                  return (
                    <option key={zoneId} value={zoneId}>
                      {zone.name}{zone.city ? ` (${zone.city})` : ''}{feeText}
                    </option>
                  );
                })
              ) : (
                <option value="">Select Delivery Zone</option>
              )}
            </select>
          </div>

          {/* Find Kitchens Button */}
          <button
            onClick={handleExploreStorefront}
            className="w-full py-3 sm:py-3.5 px-6 bg-[#F5D179] hover:bg-[#E8C547] text-[#0D4F3C] rounded-2xl text-xs sm:text-sm font-extrabold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <span>{platformSettings['cms_hero_cta_text'] || 'Find Kitchens'}</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. PLATFORM TRUST & SERVICE STANDARDS
      ───────────────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 pt-6 pb-4 w-full">
        <div className="grid grid-cols-4 gap-1 sm:gap-3 text-center items-start divide-x divide-slate-200/80">
          <div className="px-1 space-y-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center mx-auto shadow-2xs">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="font-extrabold text-[11px] sm:text-xs text-slate-900 font-mono tabular-nums leading-tight">
              25 – 35 min
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight">
              avg dispatch
            </div>
          </div>

          <div className="px-1 space-y-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center mx-auto shadow-2xs">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="font-extrabold text-[11px] sm:text-xs text-slate-900 leading-tight">
              4-Digit PIN
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight">
              safe handover
            </div>
          </div>

          <div className="px-1 space-y-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center mx-auto shadow-2xs">
              <ChefHat className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="font-extrabold text-[11px] sm:text-xs text-slate-900 leading-tight">
              {restaurants.length > 0 ? `${restaurants.length} Vetted` : 'Audited'}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight">
              hygiene kitchens
            </div>
          </div>

          <div className="px-1 space-y-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center mx-auto shadow-2xs">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-[#0D4F3C] stroke-[2.2]" />
            </div>
            <div className="font-extrabold text-[11px] sm:text-xs text-slate-900 leading-tight">
              Naira Wallet
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium leading-tight">
              zero fail pay
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. LIVE KITCHEN DISPATCH
      ───────────────────────────────────────────────────────────── */}
      <div className="max-w-xl mx-auto px-4 pb-12 w-full">
        <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
          {/* Live Kitchen Dispatch Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">Live Kitchen Dispatch</span>
            </div>
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5EF] text-[#0D4F3C] text-xs font-bold cursor-pointer border border-[#A7F3D0]/50">
                <span>{activeZoneConfig?.name || 'All Zones'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#0D4F3C] stroke-[2.5]" />
              </div>
              <select
                value={selectedZone || ''}
                onChange={(e) => setSelectedZone(e.target.value as DeliveryZone)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Filter live kitchen dispatch by zone"
              >
                {deliveryZones && deliveryZones.length > 0 ? (
                  deliveryZones.map((zone: any) => {
                    const zoneId = zone.id || zone.code;
                    return (
                      <option key={zoneId} value={zoneId}>
                        {zone.name}{zone.city ? ` (${zone.city})` : ''}
                      </option>
                    );
                  })
                ) : (
                  <option value="">All Zones</option>
                )}
              </select>
            </div>
          </div>

          {/* Real Featured Dishes */}
          {realFeaturedDishes.length > 0 ? (
            realFeaturedDishes.slice(0, 4).map(({ item, restaurant }) => (
              <div
                key={item.id}
                onClick={() => {
                  if (restaurant?.id) setSelectedRestaurantId(restaurant.id);
                  handleExploreStorefront();
                }}
                className="group flex items-center gap-3.5 p-2.5 rounded-2xl border border-slate-100 hover:border-[#C6A536] hover:bg-[#F7F3E8]/30 transition-all cursor-pointer"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-[#F7F3E8] border border-[#D8E5DC] flex items-center justify-center shrink-0 text-[#093A2D]">
                    <ChefHat className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0D4F3C] truncate">
                      {item.name}
                    </h4>
                    <span className="text-xs sm:text-sm font-bold font-mono text-slate-900">
                      {formatCurrency(item.price, currency)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {restaurant.name} · {restaurant.deliveryTimeMin || 20}–{restaurant.deliveryTimeMax || 35} min
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="font-bold">{(restaurant.rating != null ? Number(restaurant.rating) : 4.8).toFixed(1)}</span>
                    <span>·</span>
                    <span className="text-emerald-600 font-semibold">{restaurant.cuisine || 'Kitchen'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
              <p className="text-xs font-semibold text-slate-700">Kitchens Preparing Daily Menus</p>
              <p className="text-[11px] text-slate-500">
                Freshly cooked meals and chef specialties will appear here automatically as kitchens go live.
              </p>
            </div>
          )}

          {/* Instant Order Trigger */}
          <button
            onClick={handleExploreStorefront}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
          >
            <ShoppingBag className="w-4 h-4 text-[#E8C547]" />
            <span>Explore All Kitchens</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. HOW VEYRANG WORKS (3-STEP VISUAL JOURNEY)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#F6F3EE] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D4F3C]">
              Simple & Honest Logistics
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-display">
              {platformSettings['cms_how_it_works_title'] || 'How Veyrang Delivers to You'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {platformSettings['cms_how_it_works_subtitle'] || 'No guesswork, no fake GPS maps. Pure transparency from the kitchen flame to your dining table.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F0E9] text-[#0D4F3C] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
                01
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {platformSettings['cms_step1_title'] || 'Choose Your Vetted Kitchen'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {platformSettings['cms_step1_desc'] || 'Filter by cuisine, prep speed, or neighborhood. Explore authentic Nigerian dishes, Italian pizza, or burgers prepared by hygiene-audited local chefs.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F0E9] text-[#0D4F3C] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
                02
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {platformSettings['cms_step2_title'] || 'Instant Naira Settlement'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {platformSettings['cms_step2_desc'] || 'Pay seamlessly with Nigerian debit card, instant bank transfer, in-app wallet balance, or cash on delivery. Zero hidden conversion fees.'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-[#E6F0E9] text-[#0D4F3C] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
                03
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {platformSettings['cms_step3_title'] || '4-Digit PIN Doorstep Handover'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {platformSettings['cms_step3_desc'] || 'Your dispatch rider verifies your secret 4-digit PIN before opening the tamper-evident sealed parcel. Guaranteed hot, fresh, and accurate.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. FEATURED RESTAURANTS & POPULAR CUISINES
      ───────────────────────────────────────────────────────────── */}
      <section id="kitchens" className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#0D4F3C]">
                Vetted Culinary Partners
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-display mt-1">
                Explore Popular Kitchens
              </h2>
            </div>
            <button
              onClick={handleExploreStorefront}
              className="text-xs font-bold text-[#0D4F3C] hover:text-[#0D4F3C] flex items-center gap-1 cursor-pointer"
            >
              <span>View all places</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.slice(0, 6).map((restaurant) => (
              <div
                key={restaurant.id}
                onClick={handleExploreStorefront}
                className="group bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs hover:shadow-lg hover:border-[#C6A536] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={
                      restaurant.bannerUrl ||
                      (restaurant as any).banner_r2_url ||
                      restaurant.logoUrl ||
                      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
                    }
                    alt={restaurant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {restaurant.badge && (
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/75 text-white backdrop-blur-xs">
                      {restaurant.badge}
                    </span>
                  )}
                </div>

                <div className="p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0D4F3C] transition-colors truncate">
                      {restaurant.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-900 font-mono">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{(restaurant.rating != null ? Number(restaurant.rating) : 4.5).toFixed(1)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 truncate">
                    {restaurant.cuisine || restaurant.tags?.[0] || 'Kitchen'} · {restaurant.address || 'Address unavailable'}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100">
                    <div className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} min</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      ₦{restaurant.deliveryFee} delivery fee
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. NIGERIAN DELIVERY ZONES & TRUST
      ───────────────────────────────────────────────────────────── */}
      <section id="zones" className="py-16 sm:py-24 bg-[#F6F3EE] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D4F3C]">
              Wide Geographic Reach
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-display">
              Active Delivery Hubs
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Veyrang operates dedicated dispatch stations across key residential and commercial zones.
            </p>
          </div>

          {deliveryZones && deliveryZones.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {deliveryZones.map((zone: any) => {
                const zoneId = zone.id || zone.code;
                const fee = zone.base_delivery_fee ?? zone.deliveryFee;
                return (
                  <div
                    key={zoneId}
                    onClick={() => {
                      setSelectedZone(zoneId as DeliveryZone);
                      handleExploreStorefront();
                    }}
                    className={`p-4 rounded-3xl bg-white border transition-all cursor-pointer text-center space-y-1 shadow-2xs hover:shadow-md hover:border-[#C6A536] ${
                      selectedZone === zoneId ? 'border-[#0D4F3C] ring-2 ring-[#0D4F3C]/10' : 'border-slate-200/90'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-2xl bg-[#F7F3E8] text-[#0D4F3C] flex items-center justify-center mx-auto mb-2">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 truncate">{zone.name}</h4>
                    <p className="text-[11px] text-slate-400">{zone.city || 'Service Area'}</p>
                    <p className="text-[11px] font-mono font-bold text-[#0D4F3C] pt-1">
                      {fee !== undefined && fee !== null && Number.isFinite(Number(fee))
                        ? `${currency === 'USD' ? '$' : '₦'}${Number(fee).toLocaleString()} Fee`
                        : 'Fee calculated at checkout'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs sm:text-sm text-slate-400 font-medium bg-white/60 rounded-3xl border border-dashed border-slate-200">
              Delivery zones will be loaded dynamically from your connected database.
            </div>
          )}
        </div>
      </section>

    </div>
  );
};
