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
  MessageSquare
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
    : (DELIVERY_ZONES.find((z) => z.id === selectedZone) || DELIVERY_ZONES[0]);

  const handleExploreStorefront = () => {
    setActiveRole('customer');
    setActivePage('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col font-sans selection:bg-[#FF5500] selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION WITH PROMOTIONAL STATS
      ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50/50 via-white to-[#F8F9FA] pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Copy & Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left flex flex-col items-center lg:items-start">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#FFF1E8] border border-orange-200 text-[#FF5500] text-xs font-bold tracking-tight">
                <span>{platformSettings['cms_hero_badge'] || 'Global Express Food & Cloud Kitchen Network'}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 font-display tracking-tight leading-[1.12]">
                {platformSettings['cms_hero_title'] || 'Hot, Delicious Meals Delivered to Your Door in 25 Minutes.'}
              </h1>

              <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                {platformSettings['cms_hero_subtitle'] || 'Order authentic specialties, artisanal pizzas, gourmet burgers, and delicious dishes from top-rated restaurants across your city. Verified kitchen tracking, 4-digit handover PIN protection, and zero payment failures with your in-app Naira wallet.'}
              </p>

              {/* Delivery Zone Selector & Quick Storefront CTA */}
              <div className="p-2 sm:p-2.5 bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-xl">
                <div className="flex-1 flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                  <MapPin className="w-4 h-4 text-[#FF5500] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Your Delivery Zone
                    </span>
                    <select
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value as DeliveryZone)}
                      className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      {(deliveryZones && deliveryZones.length > 0 ? deliveryZones : DELIVERY_ZONES).map((zone: any) => {
                        const zoneId = zone.id || zone.code;
                        const fee = zone.base_delivery_fee ?? zone.deliveryFee ?? 500;
                        return (
                          <option key={zoneId} value={zoneId}>
                            {zone.name} ({zone.city || 'Lagos'}) · {currency === 'USD' ? '$' : '₦'}{Number(fee).toLocaleString()} Fee
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleExploreStorefront}
                  className="px-6 py-3.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>{platformSettings['cms_hero_cta_text'] || 'Find Kitchens'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Dynamic Metadata Stats from Cloudflare D1 CMS */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-4 sm:gap-x-6 text-xs text-slate-600 font-medium">
                <div>
                  <span className="font-extrabold text-slate-900 font-mono tabular-nums text-sm">
                    {platformSettings['cms_hero_stat_time'] || '25–35 min'}
                  </span>
                  <span className="ml-1 text-slate-500">average delivery</span>
                </div>
                <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
                <div>
                  <span className="font-extrabold text-slate-900 font-mono tabular-nums text-sm">
                    {platformSettings['cms_hero_stat_fee'] || '₦500'}
                  </span>
                  <span className="ml-1 text-slate-500">flat delivery in Lekki/VI</span>
                </div>
                <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
                <div>
                  <span className="font-extrabold text-slate-900 font-mono tabular-nums text-sm">
                    {platformSettings['cms_hero_stat_orders'] || '45,000+'}
                  </span>
                  <span className="ml-1 text-slate-500">meals fulfilled</span>
                </div>
                <span className="text-slate-300 font-bold" aria-hidden="true">·</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="font-extrabold text-slate-900 font-mono tabular-nums text-sm">
                    {platformSettings['cms_hero_stat_rating'] || '4.8'}
                  </span>
                  <span className="text-slate-500">(3,200+ reviews)</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Card Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md bg-white border border-slate-200/90 rounded-3xl p-5 shadow-2xl space-y-4">
                {/* Showcase Top Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-900">Live Kitchen Dispatch</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#FF5500] bg-[#FFF1E8] px-2 py-0.5 rounded-lg">
                    Lekki Phase 1
                  </span>
                </div>

                {/* Hero Featured Dish 1 */}
                <div
                  onClick={handleExploreStorefront}
                  className="group flex items-center gap-3.5 p-2.5 rounded-2xl border border-slate-100 hover:border-orange-300 hover:bg-orange-50/30 transition-all cursor-pointer"
                >
                  <img
                    src={platformSettings['cms_hero_dish1_image'] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=240&q=80'}
                    alt={platformSettings['cms_hero_dish1_title'] || 'Smoky Party Jollof & Asun'}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#FF5500] truncate">
                        {platformSettings['cms_hero_dish1_title'] || 'Smoky Party Jollof & Peppered Asun'}
                      </h4>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        ₦{Number(platformSettings['cms_hero_dish1_price'] || 3800).toLocaleString('en-NG')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {platformSettings['cms_hero_dish1_restaurant'] || 'Naija Kitchen'} · 20–30 min
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="font-bold">4.9</span>
                      <span>·</span>
                      <span className="text-emerald-600 font-semibold">Chef Signature</span>
                    </div>
                  </div>
                </div>

                {/* Hero Featured Dish 2 */}
                <div
                  onClick={handleExploreStorefront}
                  className="group flex items-center gap-3.5 p-2.5 rounded-2xl border border-slate-100 hover:border-orange-300 hover:bg-orange-50/30 transition-all cursor-pointer"
                >
                  <img
                    src={platformSettings['cms_hero_dish2_image'] || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=240&q=80'}
                    alt={platformSettings['cms_hero_dish2_title'] || 'Classic Smash Cheese Burger'}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#FF5500] truncate">
                        {platformSettings['cms_hero_dish2_title'] || 'Double Smash Beef Cheeseburger'}
                      </h4>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        ₦{Number(platformSettings['cms_hero_dish2_price'] || 4200).toLocaleString('en-NG')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {platformSettings['cms_hero_dish2_restaurant'] || 'Burger House'} · 25–35 min
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="font-bold">4.8</span>
                      <span>·</span>
                      <span className="text-orange-600 font-semibold">Bestseller</span>
                    </div>
                  </div>
                </div>

                {/* Hero Featured Dish 3 */}
                <div
                  onClick={handleExploreStorefront}
                  className="group flex items-center gap-3.5 p-2.5 rounded-2xl border border-slate-100 hover:border-orange-300 hover:bg-orange-50/30 transition-all cursor-pointer"
                >
                  <img
                    src={platformSettings['cms_hero_dish3_image'] || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=240&q=80'}
                    alt={platformSettings['cms_hero_dish3_title'] || 'Suya Beef Skewers'}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#FF5500] truncate">
                        {platformSettings['cms_hero_dish3_title'] || 'Peppered Beef Suya & Onions'}
                      </h4>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        ₦{Number(platformSettings['cms_hero_dish3_price'] || 2800).toLocaleString('en-NG')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {platformSettings['cms_hero_dish3_restaurant'] || 'Suya Express'} · 15–25 min
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="font-bold">4.7</span>
                      <span>·</span>
                      <span className="text-rose-600 font-semibold">Wood-fired Charcoal</span>
                    </div>
                  </div>
                </div>

                {/* Instant Order Trigger */}
                <button
                  onClick={handleExploreStorefront}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  <span>Start Ordering Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. HOW VEYRANG WORKS (3-STEP VISUAL JOURNEY)
      ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-[#F8F9FA] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF5500]">
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
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF5500] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
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
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF5500] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
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
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF5500] font-mono font-extrabold text-lg flex items-center justify-center shadow-xs">
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
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF5500]">
                Vetted Culinary Partners
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-display mt-1">
                Explore Popular Kitchens
              </h2>
            </div>
            <button
              onClick={handleExploreStorefront}
              className="text-xs font-bold text-[#FF5500] hover:text-[#EA4C00] flex items-center gap-1 cursor-pointer"
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
                className="group bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs hover:shadow-lg hover:border-orange-300 transition-all cursor-pointer flex flex-col justify-between"
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
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#FF5500] transition-colors truncate">
                      {restaurant.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-900 font-mono">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{(restaurant.rating != null ? Number(restaurant.rating) : 4.5).toFixed(1)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 truncate">
                    {restaurant.cuisine || restaurant.tags?.[0] || 'Kitchen'} · {restaurant.address || 'Lagos'}
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
      <section id="zones" className="py-16 sm:py-24 bg-[#F8F9FA] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF5500]">
              Wide Geographic Reach
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 font-display">
              Active Delivery Hubs
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Veyrang operates dedicated dispatch stations across key residential and commercial zones.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {(deliveryZones && deliveryZones.length > 0 ? deliveryZones : DELIVERY_ZONES).map((zone: any) => {
              const zoneId = zone.id || zone.code;
              const fee = zone.base_delivery_fee ?? zone.deliveryFee ?? 500;
              return (
                <div
                  key={zoneId}
                  onClick={() => {
                    setSelectedZone(zoneId as DeliveryZone);
                    handleExploreStorefront();
                  }}
                  className={`p-4 rounded-3xl bg-white border transition-all cursor-pointer text-center space-y-1 shadow-2xs hover:shadow-md hover:border-orange-300 ${
                    selectedZone === zoneId ? 'border-[#FF5500] ring-2 ring-orange-500/10' : 'border-slate-200/90'
                  }`}
                >
                  <div className="w-9 h-9 rounded-2xl bg-orange-50 text-[#FF5500] flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate">{zone.name}</h4>
                  <p className="text-[11px] text-slate-400">{zone.city || 'Lagos'}</p>
                  <p className="text-[11px] font-mono font-bold text-[#FF5500] pt-1">{currency === 'USD' ? '$' : '₦'}{Number(fee).toLocaleString()} Fee</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
};
