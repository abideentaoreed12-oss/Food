import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';
import { ShoppingBag, ArrowRight, Utensils } from 'lucide-react';

export const FloatingCartBar: React.FC = () => {
  const { cart, cartRestaurant, isCartOpen, setIsCartOpen, currency, activeRole, selectedRestaurantId } = useDelivery();

  if (activeRole !== 'customer') return null;
  if (!cart || cart.length === 0 || isCartOpen || selectedRestaurantId) return null;

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const restaurantName = cartRestaurant?.name || 'Kitchen';

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-0 right-0 z-40 px-4 sm:px-6 pointer-events-none max-w-xl mx-auto animate-in slide-in-from-bottom-5 duration-300">
      <div
        onClick={() => setIsCartOpen(true)}
        className="pointer-events-auto bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800 hover:border-orange-500/50 transition-all cursor-pointer flex items-center justify-between gap-3 group backdrop-blur-md bg-slate-900/95"
      >
        <div className="flex items-center gap-3">
          {/* Badge icon */}
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF5500] to-[#FF7700] text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/30 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-[#FF5500] font-black text-[11px] flex items-center justify-center border-2 border-slate-900 shadow-xs font-mono">
              {totalItemsCount}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors">
                {totalItemsCount} {totalItemsCount === 1 ? 'Item' : 'Items'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-300 truncate max-w-[140px] sm:max-w-[200px] font-medium flex items-center gap-1">
                <Utensils className="w-3 h-3 text-orange-400 shrink-0" />
                <span>{restaurantName}</span>
              </span>
            </div>
            <div className="text-sm font-black font-mono text-orange-400 tabular-nums">
              {formatCurrency(cartSubtotal, currency)}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsCartOpen(true);
          }}
          className="py-2.5 px-4 bg-[#FF5500] hover:bg-[#EA4C00] group-hover:bg-[#FF6611] text-white rounded-xl sm:rounded-2xl text-xs font-extrabold transition-all shadow-md shadow-orange-500/25 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span>View Cart</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
