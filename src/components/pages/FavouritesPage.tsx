import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import { Heart, Star, Clock, Trash2, Store, User, Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export const FavouritesPage: React.FC = () => {
  const {
    restaurants,
    setSelectedRestaurantId,
    favourites,
    toggleFavourite,
    currency,
    setActivePage
  } = useDelivery();

  const { user, loading, setIsAuthModalOpen } = useAuth();

  const favRestaurants = restaurants.filter((r) => favourites.includes(r.id));

  const restaurantImageMap: Record<string, string> = {
    'rest-1': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    'rest-2': 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=400&q=80',
    'rest-3': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    'rest-4': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    'rest-5': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
    'rest-6': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80'
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading favourites...</p>
      </div>
    );
  }

  // Require user authentication to view or manage Favourites
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center mx-auto shadow-xs">
          <Heart className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Sign In Required
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Please sign in to view, save, and manage your private list of favourite Lagos and Abuja restaurants.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <User className="w-4 h-4" />
            <span>Sign In to Access Favourites</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Private Account Favorites Sync</span>
        </div>
      </div>
    );
  }

  // Authenticated User View
  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Your Favourites
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              Private Sync Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly reorder from your most loved food spots
          </p>
        </div>
      </div>

      {favRestaurants.length === 0 ? (
        <div className="text-center py-14 px-4 rounded-3xl border border-dashed border-slate-200 bg-white">
          <Heart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No favourites saved yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Tap the heart icon on any restaurant card to save it for quick access.
          </p>
          <button
            onClick={() => setActivePage('restaurants')}
            className="mt-4 px-4 py-2 bg-[#FF5500] text-white rounded-xl text-xs font-semibold hover:bg-[#EA4C00] transition-colors cursor-pointer"
          >
            Browse Restaurants
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {favRestaurants.map((restaurant) => {
            const imageUrl =
              restaurant.bannerUrl ||
              (restaurant as any).banner_r2_url ||
              restaurant.logoUrl ||
              restaurantImageMap[restaurant.id] ||
              'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';

            return (
              <article
                key={restaurant.id}
                onClick={() => setSelectedRestaurantId(restaurant.id)}
                className="group relative rounded-3xl bg-white border border-slate-200/80 p-3.5 shadow-2xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer flex items-center gap-3.5"
              >
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-slate-100">
                  <img
                    src={imageUrl}
                    alt={restaurant.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                    {restaurant.name}
                  </h3>

                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-700">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    <span className="font-bold text-slate-900 font-mono tabular-nums">
                      {(restaurant.rating != null ? Number(restaurant.rating) : 4.5).toFixed(1)}
                    </span>
                    <span className="text-slate-400 font-mono">
                      ({restaurant.reviewCount || 0})
                    </span>
                    <span>·</span>
                    <span className="text-slate-500 truncate text-xs">
                      {restaurant.cuisine || restaurant.tags?.[0] || 'Kitchen'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} min
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(restaurant.deliveryFee, currency)} delivery fee
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavourite(restaurant.id);
                  }}
                  aria-label="Remove from favourites"
                  className="absolute top-3.5 right-3.5 p-1.5 rounded-full hover:bg-red-50 text-red-500 transition-colors cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
