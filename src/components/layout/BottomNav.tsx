import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { Home, Utensils, Receipt, ShoppingCart } from 'lucide-react';

export const BottomNav: React.FC = () => {
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

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleTabClick = (tabId: string) => {
    setActiveRole('customer');
    setIsRightDrawerOpen(false);

    if (tabId === 'home') {
      setIsCartOpen(false);
      setActivePage('home');
    } else if (tabId === 'food') {
      setIsCartOpen(false);
      setActivePage('restaurants');
    } else if (tabId === 'express') {
      setIsCartOpen(false);
      setActivePage('offers');
    } else if (tabId === 'history') {
      setIsCartOpen(false);
      setActivePage('orders');
    } else if (tabId === 'cart') {
      setIsCartOpen(true);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only render when in customer storefront view
  if (activeRole !== 'customer') return null;

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/98 backdrop-blur-lg border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] py-1.5 px-2 pointer-events-auto"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center">
        
        {/* Tab 1: Home */}
        <button
          onClick={() => handleTabClick('home')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Home Page"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activePage === 'home' && !isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <Home className="w-5 h-5 stroke-[2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              activePage === 'home' && !isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            Home
          </span>
        </button>

        {/* Tab 2: Food */}
        <button
          onClick={() => handleTabClick('food')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Food Categories & Menus"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activePage === 'restaurants' && !isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <Utensils className="w-5 h-5 stroke-[2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              activePage === 'restaurants' && !isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            Food
          </span>
        </button>

        {/* Tab 3: Express */}
        <button
          onClick={() => handleTabClick('express')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
          aria-label="Express Hot Deals & Fast Orders"
        >
          <div
            className={`p-1.5 rounded-xl transition-all relative ${
              activePage === 'offers' && !isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
            </svg>
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF5500] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              activePage === 'offers' && !isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            Express
          </span>
        </button>

        {/* Tab 4: History */}
        <button
          onClick={() => handleTabClick('history')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Order History"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activePage === 'orders' && !isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <Receipt className="w-5 h-5 stroke-[2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              activePage === 'orders' && !isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            History
          </span>
        </button>

        {/* Tab 5: Cart */}
        <button
          onClick={() => handleTabClick('cart')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
          aria-label="Shopping Cart"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-5 h-5 stroke-[2]" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF5500] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            Cart
          </span>
        </button>

      </div>
    </nav>
  );
};
