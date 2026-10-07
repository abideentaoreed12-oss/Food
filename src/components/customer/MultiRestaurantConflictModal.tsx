import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { ShoppingBag, AlertTriangle, X, RefreshCw } from 'lucide-react';

export const MultiRestaurantConflictModal: React.FC = () => {
  const {
    cartConflict,
    cancelCartConflict,
    confirmCartConflict,
    cartRestaurant,
    currency
  } = useDelivery();

  if (!cartConflict) return null;

  const { newItem, newRestaurantName } = cartConflict;
  const currentRestaurantName = cartRestaurant?.name || 'another restaurant';

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 font-sans">
        
        {/* Top Accent Bar */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/80 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={cancelCartConflict}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 pb-6 space-y-3">
          <h3 className="text-lg font-bold text-slate-900 font-display">
            Create new order?
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your cart already contains items from <strong className="text-slate-900">{currentRestaurantName}</strong>. Food delivery orders can only contain items from one kitchen at a time.
          </p>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Item to add:</span>
            </div>
            <p className="pl-5 font-bold text-orange-600">
              {newItem.name} <span className="font-normal text-slate-500">from {newRestaurantName}</span>
            </p>
          </div>

          <p className="text-[11px] text-slate-400">
            Would you like to clear your current cart and start a new order with items from <strong className="text-slate-700">{newRestaurantName}</strong>?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            onClick={cancelCartConflict}
            className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer shadow-2xs"
          >
            Keep Existing Cart
          </button>
          <button
            onClick={confirmCartConflict}
            className="flex-1 py-3 px-4 bg-[#FF5500] hover:bg-[#EA4C00] text-white font-bold text-xs rounded-2xl transition-all cursor-pointer shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Clear & Add New</span>
          </button>
        </div>
      </div>
    </div>
  );
};
