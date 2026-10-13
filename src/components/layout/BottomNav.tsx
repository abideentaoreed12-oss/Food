'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeRole,
    cart,
    isCartOpen,
    setIsCartOpen,
    setIsRightDrawerOpen
  } = useDelivery();

  const { isAuthenticated, setIsAuthModalOpen } = useAuth();
  const [optimisticTab, setOptimisticTab] = useState<'home' | 'food' | 'express' | 'history' | 'cart' | null>(null);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Eagerly prefetch all 4 destination routes on component mount
  useEffect(() => {
    try {
      router.prefetch(ROUTES.HOME);
      router.prefetch(ROUTES.RESTAURANTS);
      router.prefetch(ROUTES.OFFERS);
      router.prefetch(ROUTES.ORDERS);
    } catch {}
  }, [router]);

  // Reset optimistic tab when pathname changes or cart state changes
  useEffect(() => {
    setOptimisticTab(null);
  }, [pathname, isCartOpen]);

  if (activeRole !== 'customer') return null;

  // Resolve active tab with 0ms optimistic priority on user touch/click
  const resolvedActiveTab = (() => {
    if (optimisticTab) return optimisticTab;
    if (isCartOpen) return 'cart';
    if (pathname === ROUTES.HOME) return 'home';
    if (pathname === ROUTES.RESTAURANTS || pathname.startsWith('/restaurants/')) return 'food';
    if (pathname === ROUTES.OFFERS) return 'express';
    if (pathname === ROUTES.ORDERS) return 'history';
    return 'home';
  })();

  const handleNavigate = (tab: 'home' | 'food' | 'express' | 'history', href: string) => {
    setOptimisticTab(tab);
    if (isCartOpen) setIsCartOpen(false);
    setIsRightDrawerOpen(false);
    if (pathname !== href) {
      router.push(href);
    }
  };

  const handleCartClick = () => {
    setOptimisticTab('cart');
    setIsRightDrawerOpen(false);
    setIsCartOpen(true);
  };

  const isHomeActive = resolvedActiveTab === 'home';
  const isFoodActive = resolvedActiveTab === 'food';
  const isExpressActive = resolvedActiveTab === 'express';
  const isHistoryActive = resolvedActiveTab === 'history';
  const isCartActive = resolvedActiveTab === 'cart';

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] py-1.5 px-4 pointer-events-auto touch-manipulation select-none"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center">
        {/* 1. Home Tab */}
        <button
          type="button"
          onClick={() => handleNavigate('home', ROUTES.HOME)}
          onMouseEnter={() => router.prefetch(ROUTES.HOME)}
          onTouchStart={() => router.prefetch(ROUTES.HOME)}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none"
          style={{ touchAction: 'manipulation' }}
          aria-label="Home"
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-100 ${isHomeActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Home className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-100 ${
              isHomeActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Home
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-100 ${isHomeActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        {/* 2. Food Tab */}
        <button
          type="button"
          onClick={() => handleNavigate('food', ROUTES.RESTAURANTS)}
          onMouseEnter={() => router.prefetch(ROUTES.RESTAURANTS)}
          onTouchStart={() => router.prefetch(ROUTES.RESTAURANTS)}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none"
          style={{ touchAction: 'manipulation' }}
          aria-label="Food"
          aria-current={isFoodActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-100 ${isFoodActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Utensils className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-100 ${
              isFoodActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Food
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-100 ${isFoodActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        {/* 3. Express Tab */}
        <button
          type="button"
          onClick={() => handleNavigate('express', ROUTES.OFFERS)}
          onMouseEnter={() => router.prefetch(ROUTES.OFFERS)}
          onTouchStart={() => router.prefetch(ROUTES.OFFERS)}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative"
          style={{ touchAction: 'manipulation' }}
          aria-label="Express Offers"
          aria-current={isExpressActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-100 ${isExpressActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-100 ${
              isExpressActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Express
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-100 ${isExpressActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        {/* 4. History Tab */}
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              setIsAuthModalOpen(true);
              return;
            }
            handleNavigate('history', ROUTES.ORDERS);
          }}
          onMouseEnter={() => router.prefetch(ROUTES.ORDERS)}
          onTouchStart={() => router.prefetch(ROUTES.ORDERS)}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative"
          style={{ touchAction: 'manipulation' }}
          aria-label="History"
          aria-current={isHistoryActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-100 ${isHistoryActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Receipt className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-100 ${
              isHistoryActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            History
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-100 ${isHistoryActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        {/* 5. Cart Tab */}
        <button
          type="button"
          onClick={handleCartClick}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative"
          style={{ touchAction: 'manipulation' }}
          aria-label={totalCartCount > 0 ? `Shopping Cart with ${totalCartCount} items` : 'Shopping Cart'}
          aria-expanded={isCartActive}
        >
          <div className={`transition-colors duration-100 relative ${isCartActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-[#0D4F3C] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-100 ${
              isCartActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Cart
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-100 ${isCartActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>
      </div>
    </nav>
  );
};
