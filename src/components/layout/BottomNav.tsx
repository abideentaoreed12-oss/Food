'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activeRole,
    setActiveRole,
    setActivePage,
    cart,
    isCartOpen,
    setIsCartOpen,
    isRightDrawerOpen,
    setIsRightDrawerOpen
  } = useDelivery();

  const { isAuthenticated, setIsAuthModalOpen, user } = useAuth();
  const [optimisticTab, setOptimisticTab] = useState<'home' | 'food' | 'express' | 'history' | 'cart' | null>(null);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Clear optimistic override whenever pathname or drawer state updates
  useEffect(() => {
    setOptimisticTab(null);
  }, [pathname, isCartOpen]);

  // Pre-warm client route cache on mount for instant single-click transitions
  useEffect(() => {
    try {
      router.prefetch(ROUTES.HOME);
      router.prefetch(ROUTES.RESTAURANTS);
      router.prefetch(ROUTES.OFFERS);
      router.prefetch(ROUTES.ORDERS);
      router.prefetch(ROUTES.CART);
    } catch {}
  }, [router]);

  if (activeRole !== 'customer') return null;

  // Resolve active tab
  const resolvedActiveTab = (() => {
    if (optimisticTab) return optimisticTab;
    if (pathname === ROUTES.CART) return 'cart';
    if (isCartOpen) return 'cart';
    if (pathname === ROUTES.HOME) return 'home';
    if (pathname === ROUTES.RESTAURANTS || Boolean(pathname?.startsWith('/restaurants/'))) return 'food';
    if (pathname === ROUTES.OFFERS) return 'express';
    if (pathname === ROUTES.ORDERS) return 'history';
    return 'home';
  })();

  const closeDrawers = useCallback(() => {
    if (isCartOpen) setIsCartOpen(false);
    if (isRightDrawerOpen) setIsRightDrawerOpen(false);
  }, [isCartOpen, isRightDrawerOpen, setIsCartOpen, setIsRightDrawerOpen]);

  // Pre-warm route cache on pointer contact
  const handlePointerDown = useCallback((targetHref: string) => {
    try {
      router.prefetch(targetHref);
    } catch {}
  }, [router]);

  // Fast navigation handler: prevents conflicting duplicate Link events and pushes cleanly
  const handleTabClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    tab: 'home' | 'food' | 'express' | 'history' | 'cart',
    targetHref: string
  ) => {
    e.preventDefault();

    // Immediate optimistic highlight for 0ms visual feedback
    setOptimisticTab(tab);
    closeDrawers();

    if (activeRole !== 'customer') setActiveRole('customer');
    if (tab === 'food') setActivePage('restaurants');
    else if (tab === 'home') setActivePage(user ? 'home' : 'landing');
    else if (tab === 'express') setActivePage('offers');
    else if (tab === 'history') setActivePage('orders');

    // If tapping current route, instant scroll to top
    if (pathname === targetHref) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    // Single authoritative router push
    router.push(targetHref);
  };

  const handleHistoryClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    handleTabClick(e, 'history', ROUTES.ORDERS);
  };

  const isHomeActive = resolvedActiveTab === 'home';
  const isFoodActive = resolvedActiveTab === 'food';
  const isExpressActive = resolvedActiveTab === 'express';
  const isHistoryActive = resolvedActiveTab === 'history';
  const isCartActive = resolvedActiveTab === 'cart';

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] py-1 px-2 sm:px-4 pointer-events-auto touch-manipulation select-none pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))]"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center">
        {/* 1. Home Tab */}
        <Link
          href={ROUTES.HOME}
          prefetch={true}
          onClick={(e) => handleTabClick(e, 'home', ROUTES.HOME)}
          onPointerDown={() => handlePointerDown(ROUTES.HOME)}
          className="flex flex-col items-center justify-center min-h-[50px] py-1 px-1 rounded-2xl group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label="Home"
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-150 ${isHomeActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Home className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-150 ${
              isHomeActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Home
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-150 ${isHomeActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </Link>

        {/* 2. Food Tab */}
        <Link
          href={ROUTES.RESTAURANTS}
          prefetch={true}
          onClick={(e) => handleTabClick(e, 'food', ROUTES.RESTAURANTS)}
          onPointerDown={() => handlePointerDown(ROUTES.RESTAURANTS)}
          className="flex flex-col items-center justify-center min-h-[50px] py-1 px-1 rounded-2xl group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label="Food"
          aria-current={isFoodActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-150 ${isFoodActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Utensils className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-150 ${
              isFoodActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Food
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-150 ${isFoodActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </Link>

        {/* 3. Express Tab */}
        <Link
          href={ROUTES.OFFERS}
          prefetch={true}
          onClick={(e) => handleTabClick(e, 'express', ROUTES.OFFERS)}
          onPointerDown={() => handlePointerDown(ROUTES.OFFERS)}
          className="flex flex-col items-center justify-center min-h-[50px] py-1 px-1 rounded-2xl group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label="Express Offers"
          aria-current={isExpressActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-150 ${isExpressActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-150 ${
              isExpressActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Express
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-150 ${isExpressActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </Link>

        {/* 4. History Tab */}
        <Link
          href={ROUTES.ORDERS}
          prefetch={true}
          onClick={handleHistoryClick}
          onPointerDown={() => {
            if (isAuthenticated) handlePointerDown(ROUTES.ORDERS);
          }}
          className="flex flex-col items-center justify-center min-h-[50px] py-1 px-1 rounded-2xl group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label="History"
          aria-current={isHistoryActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-150 ${isHistoryActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Receipt className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-150 ${
              isHistoryActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            History
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-150 ${isHistoryActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </Link>

        {/* 5. Cart Tab */}
        <Link
          href={ROUTES.CART}
          prefetch={true}
          onClick={(e) => handleTabClick(e, 'cart', ROUTES.CART)}
          onPointerDown={() => handlePointerDown(ROUTES.CART)}
          className="flex flex-col items-center justify-center min-h-[50px] py-1 px-1 rounded-2xl group cursor-pointer transition-transform active:scale-95 touch-manipulation focus:outline-none relative select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          aria-label={totalCartCount > 0 ? `Shopping Cart with ${totalCartCount} items` : 'Shopping Cart'}
          aria-current={isCartActive ? 'page' : undefined}
        >
          <div className={`transition-colors duration-150 relative ${isCartActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-[#0D4F3C] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors duration-150 ${
              isCartActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Cart
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all duration-150 ${isCartActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </Link>
      </div>
    </nav>
  );
};
