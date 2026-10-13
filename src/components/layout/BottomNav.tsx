import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

import Link from 'next/link';

export const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activePage,
    setActivePage,
    activeRole,
    setActiveRole,
    cart,
    isCartOpen,
    setIsCartOpen,
    setIsRightDrawerOpen
  } = useDelivery();

  const { isAuthenticated, setIsAuthModalOpen } = useAuth();

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (activeRole !== 'customer') return null;

  // Fix active indicator logic: Home is ONLY active when exactly at ROUTES.HOME
  // and user is on the home/landing page. Food is active on /restaurants and subroutes.
  const isHomeActive = pathname === ROUTES.HOME && !isCartOpen;
  const isFoodActive = (pathname === ROUTES.RESTAURANTS || pathname.startsWith('/restaurants/')) && !isCartOpen;
  const isExpressActive = pathname === ROUTES.OFFERS && !isCartOpen;
  const isHistoryActive = pathname === ROUTES.ORDERS && !isCartOpen;
  const isCartActive = isCartOpen;

  const gridCols = isAuthenticated ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] py-1.5 px-4 pointer-events-auto touch-manipulation select-none"
    >
      <div className={`max-w-md mx-auto grid ${gridCols} items-center`}>
        {/* 1. Home Tab */}
        <Link
          href={ROUTES.HOME}
          prefetch={true}
          onClick={() => {
            if (isCartOpen) setIsCartOpen(false);
            setIsRightDrawerOpen(false);
            if (activeRole !== 'customer') setActiveRole('customer');
            const targetPage = isAuthenticated ? 'home' : 'landing';
            if (activePage !== targetPage) setActivePage(targetPage);
          }}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95"
          aria-label="Home Page"
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
          onClick={() => {
            if (isCartOpen) setIsCartOpen(false);
            setIsRightDrawerOpen(false);
            if (activeRole !== 'customer') setActiveRole('customer');
            if (activePage !== 'restaurants') setActivePage('restaurants');
          }}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95"
          aria-label="Food / Restaurants"
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

        {/* 3. Express Tab (Authenticated) */}
        {isAuthenticated && (
          <Link
            href={ROUTES.OFFERS}
            prefetch={true}
            onClick={() => {
              if (isCartOpen) setIsCartOpen(false);
              setIsRightDrawerOpen(false);
              if (activeRole !== 'customer') setActiveRole('customer');
              if (activePage !== 'offers') setActivePage('offers');
            }}
            className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 relative"
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
        )}

        {/* 4. History Tab (Authenticated) */}
        {isAuthenticated && (
          <Link
            href={ROUTES.ORDERS}
            prefetch={true}
            onClick={() => {
              if (isCartOpen) setIsCartOpen(false);
              setIsRightDrawerOpen(false);
              if (activeRole !== 'customer') setActiveRole('customer');
              if (activePage !== 'orders') setActivePage('orders');
            }}
            className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 relative"
            aria-label="Order History"
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
        )}

        {/* 5. Cart Tab */}
        <button
          type="button"
          onClick={() => {
            setIsRightDrawerOpen(false);
            setIsCartOpen(true);
          }}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-transform active:scale-95 relative"
          aria-label={totalCartCount > 0 ? `Shopping Cart with ${totalCartCount} items` : 'Shopping Cart'}
          aria-expanded={isCartActive}
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
        </button>
      </div>
    </nav>
  );
};
