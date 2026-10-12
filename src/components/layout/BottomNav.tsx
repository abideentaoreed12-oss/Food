import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

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

  const handleTabClick = (tabId: string) => {
    setActiveRole('customer');
    setIsRightDrawerOpen(false);

    if (tabId === 'home') {
      setIsCartOpen(false);
      setActivePage(isAuthenticated ? 'home' : 'landing');
      router.push(ROUTES.HOME);
    } else if (tabId === 'food') {
      setIsCartOpen(false);
      setActivePage('restaurants');
      router.push(ROUTES.RESTAURANTS);
    } else if (tabId === 'express') {
      setIsCartOpen(false);
      setActivePage('offers');
      router.push(ROUTES.OFFERS);
    } else if (tabId === 'history') {
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
        return;
      }
      setIsCartOpen(false);
      setActivePage('orders');
      router.push(ROUTES.ORDERS);
    } else if (tabId === 'cart') {
      setIsCartOpen(true);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (activeRole !== 'customer') return null;

  const isHomeActive = (pathname === ROUTES.HOME || activePage === 'home' || activePage === 'landing') && !isCartOpen;
  const isFoodActive = (pathname === ROUTES.RESTAURANTS || activePage === 'restaurants') && !isCartOpen;
  const isExpressActive = (pathname === ROUTES.OFFERS || activePage === 'offers') && !isCartOpen;
  const isHistoryActive = (pathname === ROUTES.ORDERS || activePage === 'orders') && !isCartOpen;
  const isCartActive = isCartOpen;

  const gridCols = isAuthenticated ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] py-1.5 px-4 pointer-events-auto"
    >
      <div className={`max-w-md mx-auto grid ${gridCols} items-center`}>
        <button
          type="button"
          onClick={() => handleTabClick('home')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Home Page"
        >
          <div className={`transition-all ${isHomeActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Home className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              isHomeActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Home
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all ${isHomeActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('food')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Food / Restaurants"
        >
          <div className={`transition-all ${isFoodActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <Utensils className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              isFoodActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Food
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all ${isFoodActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => handleTabClick('express')}
            className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
            aria-label="Express Offers"
          >
            <div className={`transition-all ${isExpressActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
              <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span
              className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
                isExpressActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
              }`}
            >
              Express
            </span>
            <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all ${isExpressActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
          </button>
        )}

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => handleTabClick('history')}
            className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
            aria-label="Order History"
          >
            <div className={`transition-all ${isHistoryActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span
              className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
                isHistoryActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
              }`}
            >
              History
            </span>
            <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all ${isHistoryActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTabClick('cart')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
          aria-label="Shopping Cart"
        >
          <div className={`transition-all relative ${isCartActive ? 'text-[#0D4F3C]' : 'text-slate-400 group-hover:text-slate-700'}`}>
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-[#0D4F3C] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              isCartActive ? 'text-[#0D4F3C] font-bold' : 'text-slate-500'
            }`}
          >
            Cart
          </span>
          <div className={`w-6 h-0.5 rounded-full mt-0.5 transition-all ${isCartActive ? 'bg-[#0D4F3C]' : 'bg-transparent'}`} />
        </button>
      </div>
    </nav>
  );
};
