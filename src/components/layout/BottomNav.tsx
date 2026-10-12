import React from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { Home, Utensils, LayoutGrid, Receipt, ShoppingCart } from 'lucide-react';

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

  const { isAuthenticated, setIsAuthModalOpen } = useAuth();

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
      // Orders/history is private — require a real session
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
        return;
      }
      setIsCartOpen(false);
      setActivePage('orders');
    } else if (tabId === 'cart') {
      setIsCartOpen(true);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Only render when in customer storefront view
  if (activeRole !== 'customer') return null;

  // Guests: Home · Food · Express · Cart (4)
  // Logged-in: Home · Food · Express · History · Cart (5)
  const gridCols = isAuthenticated ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav
      aria-label="Bottom Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/98 backdrop-blur-lg border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] py-1.5 px-2 pointer-events-auto"
    >
      <div className={`max-w-md mx-auto grid ${gridCols} items-center`}>
        {/* Tab 1: Home */}
        <button
          type="button"
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
          type="button"
          onClick={() => handleTabClick('food')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors"
          aria-label="Food / Restaurants"
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

        {/* Tab 3: Express (offers) */}
        <button
          type="button"
          onClick={() => handleTabClick('express')}
          className="flex flex-col items-center justify-center py-1 group cursor-pointer transition-colors relative"
          aria-label="Express Offers"
        >
          <div
            className={`p-1.5 rounded-xl transition-all ${
              activePage === 'offers' && !isCartOpen
                ? 'bg-orange-50 text-[#FF5500]'
                : 'text-slate-500 group-hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-5 h-5 stroke-[2]" />
          </div>
          <span
            className={`text-[11px] font-semibold mt-0.5 tracking-tight transition-colors ${
              activePage === 'offers' && !isCartOpen ? 'text-[#FF5500] font-bold' : 'text-slate-500'
            }`}
          >
            Express
          </span>
        </button>

        {/* Tab 4: History — logged-in customers only */}
        {isAuthenticated && (
          <button
            type="button"
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
        )}

        {/* Tab last: Cart */}
        <button
          type="button"
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
                {totalCartCount > 99 ? '99+' : totalCartCount}
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
