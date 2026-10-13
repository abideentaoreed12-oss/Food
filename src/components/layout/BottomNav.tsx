'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

export const BottomNav: React.FC = () => {
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

  // Clear optimistic override whenever pathname or drawer state updates
  useEffect(() => {
    setOptimisticTab(null);
  }, [pathname, isCartOpen]);

  if (activeRole !== 'customer') return null;

  // Resolve active tab: optimistic touch selection takes highest priority for instant visual feedback
  const resolvedActiveTab = (() => {
    if (optimisticTab) return optimisticTab;
    if (pathname === ROUTES.CART) return 'cart';
    if (isCartOpen) return 'cart';
    if (pathname === ROUTES.HOME) return 'home';
    if (pathname === ROUTES.RESTAURANTS || pathname.startsWith('/restaurants/')) return 'food';
    if (pathname === ROUTES.OFFERS) return 'express';
    if (pathname === ROUTES.ORDERS) return 'history';
    return 'home';
  })();

  const closeDrawers = () => {
    if (isCartOpen) setIsCartOpen(false);
    setIsRightDrawerOpen(false);
  };

  const handleLinkTouch = (tab: 'home' | 'food' | 'express' | 'history' | 'cart') => {
    setOptimisticTab(tab);
    closeDrawers();
  };

  const handleHistoryClick = (e: React.MouseEvent) => {
    handleLinkTouch('history');
    if (!isAuthenticated) {
      e.preventDefault();
      setIsAuthModalOpen(true);
    }
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
        <Link
          href={ROUTES.HOME}
          prefetch={true}
          onClick={() => handleLinkTouch('home')}
          onTouchStart={() => setOptimisticTab('home')}
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
        </Link>

        {/* 2. Food Tab */}
        <Link
          href={ROUTES.RESTAURANTS}
          prefetch={true}
          onClick={() => handleLinkTouch('food')}
          onTouchStart={() => setOptimisticTab('food')}
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
        </Link>

        {/* 3. Express Tab */}
        <Link
          href={ROUTES.OFFERS}
          prefetch={true}
          onClick={() => handleLinkTouch('express')}
          onTouchStart={() => setOptimisticTab('express')}
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
        </Link>

        {/* 4. History Tab */}
        <Link
          href={ROUTES.ORDERS}
          prefetch={true}
          onClick={handleHistoryClick}
          onTouchStart={() => {
            if (isAuthenticated) setOptimisticTab('history');
          }}
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
        </Link>

        {/* 5. Cart Tab */}
        <Link
          href={ROUTES.CART}
          prefetch={true}
          onClick={() => handleLinkTouch('cart')}
          onTouchStart={() => setOptimisticTab('cart')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative"
          style={{ touchAction: 'manipulation' }}
          aria-label={totalCartCount > 0 ? `Shopping Cart with ${totalCartCount} items` : 'Shopping Cart'}
          aria-current={isCartActive ? 'page' : undefined}
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
        </Link>
      </div>
    </nav>
  );
};
