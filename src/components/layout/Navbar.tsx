import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { SavedAddress } from '../../types';
import {
  ShoppingCart,
  MapPin,
  ChevronDown,
  User,
  Wallet,
  LogOut,
  LogIn,
  ShoppingBag,
  Check,
  X,
  ShieldAlert,
  ChefHat,
  Bike,
  Plus,
  Home,
  Building,
  CheckCircle2,
  Navigation,
  Trash2
} from 'lucide-react';
import { VeyrangLogo } from '../common/VeyrangLogo';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import { ProAddressForm } from '../common/ProAddressForm';

export const Navbar: React.FC = () => {
  const {
    cart,
    setIsCartOpen,
    isRightDrawerOpen,
    setIsRightDrawerOpen,
    savedAddresses,
    selectedAddress,
    setSelectedAddress,
    addSavedAddress,
    deleteSavedAddress,
    refreshData,
    activePage,
    setActivePage,
    activeRole,
    setActiveRole,
    walletBalanceNGN,
    setIsWalletModalOpen,
    platformSettings
  } = useDelivery();

  const { user, logout, setIsAuthModalOpen } = useAuth();
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newAddress, setNewAddress] = useState('');
  const [newApartment, setNewApartment] = useState('');
  const [newCity, setNewCity] = useState('Lagos');
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const initials = (displayName.trim().split(/\s+/).map((n) => n[0]).join('') || 'U').substring(0, 2).toUpperCase();
  const firstName = displayName.trim().split(/\s+/)[0] || 'User';
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const closeDropdowns = () => {
    setIsZoneDropdownOpen(false);
    setIsUserDropdownOpen(false);
  };

  const toggleZoneDropdown = () => {
    setIsUserDropdownOpen(false);
    setIsZoneDropdownOpen((prev) => !prev);
  };

  const toggleUserDropdown = () => {
    setIsZoneDropdownOpen(false);
    setIsUserDropdownOpen((prev) => !prev);
  };

  const isLanding = activeRole === 'customer' && activePage === 'landing';

  return (
    <header className={`sticky top-0 z-40 transition-colors duration-200 ${
      isLanding
        ? 'bg-[#0D4F3C] text-white border-b border-[#0D4F3C]'
        : 'bg-white border-b border-slate-100 shadow-xs'
    }`}>
      {isUserDropdownOpen && (
        <div onClick={closeDropdowns} className="fixed inset-0 z-40 bg-black/5 pointer-events-auto" aria-hidden="true" />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {activeRole !== 'customer' ? (
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <VeyrangLogo iconSize="md" textSize="md" />
              {activeRole === 'restaurant' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ChefHat className="w-3.5 h-3.5" /> Kitchen Portal (KDS)
                </span>
              )}
              {activeRole === 'courier' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                  <Bike className="w-3.5 h-3.5" /> Courier Rider Portal
                </span>
              )}
              {activeRole === 'admin' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin Console
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button onClick={toggleUserDropdown} className="flex items-center gap-1.5 focus:outline-none cursor-pointer active:scale-95 transition-all">
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 transition-all shadow-2xs">
                    <div className="w-6 h-6 rounded-full font-extrabold text-[11px] flex items-center justify-center shrink-0 bg-[#0D4F3C] text-white shadow-2xs">{initials}</div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[80px] sm:max-w-none">{firstName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[2.5] shrink-0" />
                  </div>
                </button>
                {isUserDropdownOpen && user && (
                  <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2 text-xs animate-in fade-in">
                    <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                      <p className="font-bold text-slate-900 truncate">{displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate font-mono">{user.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-[#E8F5EF] text-[#0D4F3C] px-2 py-0.5 rounded-md">{user.role}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button onClick={async () => { closeDropdowns(); await logout(); setActiveRole('customer'); setActivePage('home'); }} className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold">
                        <LogOut className="w-4 h-4" /><span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { closeDropdowns(); setIsRightDrawerOpen(true); }} aria-label="Open portal navigation" className="group relative p-2 text-slate-900 hover:text-[#0D4F3C] hover:bg-[#E8F5EF]/70 rounded-full transition-colors cursor-pointer flex items-center justify-center" title="Open Portal Menu">
                <div className="flex flex-col justify-center items-center gap-1 w-5 h-4.5">
                  <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#0D4F3C] rounded-full transition-colors" />
                  <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#0D4F3C] rounded-full transition-colors" />
                  <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#0D4F3C] rounded-full transition-colors" />
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <button onClick={() => { closeDropdowns(); setActiveRole('customer'); setActivePage('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="focus-visible:outline-none focus:outline-none border-none outline-none active:scale-95 transition-transform">
                  <VeyrangLogo iconSize="md" textSize="md" lightMode={isLanding} />
                </button>
                <nav className="hidden md:flex items-center gap-1 pl-2">
                  {(['landing', 'restaurants', 'offers', 'orders'] as const).map((page) => (
                    <button
                      key={page}
                      onClick={() => { closeDropdowns(); setActiveRole('customer'); setActivePage(page === 'landing' ? 'landing' : page); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isLanding
                          ? activePage === page
                            ? 'bg-white/20 text-white'
                            : 'text-emerald-100 hover:text-white hover:bg-white/10'
                          : activeRole === 'customer' && activePage === page
                          ? 'bg-[#E8F5EF] text-[#0D4F3C]'
                          : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {page === 'landing' ? 'Home' : page === 'restaurants' ? 'Restaurants' : page === 'offers' ? 'Offers' : 'My Orders'}
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                <button
                  onClick={() => { closeDropdowns(); setIsCartOpen(true); }}
                  aria-label={`Cart with ${totalCartCount} items`}
                  className={`relative p-1.5 transition-colors cursor-pointer flex items-center justify-center ${
                    isLanding
                      ? 'text-white hover:text-emerald-200'
                      : 'text-slate-900 hover:text-[#0D4F3C]'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                  {totalCartCount > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-4.5 px-1 text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs ${
                      isLanding ? 'bg-[#E8C547] text-[#0D4F3C]' : 'bg-[#0D4F3C] text-white'
                    }`}>{totalCartCount}</span>
                  )}
                </button>
                <div className="relative">
                  <button onClick={() => { if (user) toggleUserDropdown(); else { closeDropdowns(); setIsAuthModalOpen(true); } }} className="flex items-center gap-1.5 focus:outline-none cursor-pointer active:scale-95 transition-all">
                    {user ? (
                      <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all shadow-2xs ${
                        isLanding
                          ? 'border border-emerald-400/30 bg-white/15 text-white hover:bg-white/25'
                          : 'border border-emerald-200 bg-[#E8F5EF]/80 hover:bg-[#E8F5EF] text-slate-900'
                      }`}>
                        <div className={`w-6 h-6 rounded-full font-extrabold text-[11px] flex items-center justify-center shrink-0 ${
                          isLanding ? 'bg-[#E8C547] text-[#0D4F3C]' : 'bg-[#0D4F3C] text-white shadow-2xs'
                        }`}>{initials}</div>
                        <span className="text-xs sm:text-sm font-bold truncate max-w-[80px] sm:max-w-none">Hi, {firstName}</span>
                        <ChevronDown className={`w-3.5 h-3.5 stroke-[2.5] shrink-0 ${isLanding ? 'text-emerald-200' : 'text-[#0D4F3C]'}`} />
                      </div>
                    ) : (
                      <div className="px-3.5 py-1.5 rounded-full bg-[#F5D179] hover:bg-[#E8C547] text-[#0D4F3C] text-xs sm:text-sm font-extrabold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95">
                        <User className="w-3.5 h-3.5 stroke-[2.5]" /><span>Sign In</span>
                      </div>
                    )}
                  </button>
                  {isUserDropdownOpen && user && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2 text-xs animate-in fade-in">
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                        <p className="font-bold text-slate-900 truncate">{displayName}</p>
                        <p className="text-[11px] text-slate-500 truncate font-mono">{user.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-[#E8F5EF] text-[#0D4F3C] px-2 py-0.5 rounded-md">{user.role}</span>
                      </div>
                      <div className="py-1">
                        <button onClick={() => { closeDropdowns(); setIsWalletModalOpen(true); }} className="w-full text-left px-4 py-2 hover:bg-[#E8F5EF]/50 flex items-center justify-between text-slate-800 cursor-pointer">
                          <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-[#0D4F3C]" /><span>In-App Wallet</span></span>
                          <span className="font-bold font-mono text-emerald-700">₦{walletBalanceNGN.toLocaleString('en-NG')}</span>
                        </button>
                        <button onClick={() => { closeDropdowns(); setActiveRole('customer'); setActivePage('orders'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left px-4 py-2 hover:bg-[#E8F5EF]/50 flex items-center gap-2 text-slate-800 cursor-pointer">
                          <ShoppingBag className="w-4 h-4 text-slate-600" /><span>My Past Orders</span>
                        </button>
                        <button onClick={() => { closeDropdowns(); setActiveRole('customer'); setActivePage('account'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left px-4 py-2 hover:bg-[#E8F5EF]/50 flex items-center gap-2 text-slate-800 cursor-pointer">
                          <User className="w-4 h-4 text-slate-600" /><span>Profile & Addresses</span>
                        </button>
                      </div>
                      <div className="border-t border-slate-100 pt-1 mt-1">
                        <button onClick={async () => { closeDropdowns(); await logout(); setActiveRole('customer'); setActivePage('home'); }} className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold">
                          <LogOut className="w-4 h-4" /><span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { closeDropdowns(); setIsRightDrawerOpen(true); }}
                  aria-label="Open navigation menu"
                  className={`group relative p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center ${
                    isLanding
                      ? 'text-white hover:text-[#E8C547]'
                      : 'text-slate-900 hover:text-[#0D4F3C]'
                  }`}
                  title="Open Menu"
                >
                  <div className="flex flex-col justify-center items-center gap-1 w-5 h-4">
                    <span className={`w-5 h-[2px] rounded-full transition-colors ${
                      isLanding ? 'bg-white group-hover:bg-[#E8C547]' : 'bg-slate-900 group-hover:bg-[#0D4F3C]'
                    }`} />
                    <span className={`w-5 h-[2px] rounded-full transition-colors ${
                      isLanding ? 'bg-white group-hover:bg-[#E8C547]' : 'bg-slate-900 group-hover:bg-[#0D4F3C]'
                    }`} />
                    <span className={`w-5 h-[2px] rounded-full transition-colors ${
                      isLanding ? 'bg-white group-hover:bg-[#E8C547]' : 'bg-slate-900 group-hover:bg-[#0D4F3C]'
                    }`} />
                  </div>
                </button>
              </div>
            </div>
            {user && (
              <div className="pb-2.5 -mt-1">
                <button type="button" onClick={toggleZoneDropdown} className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-[#E8F5EF] hover:border-emerald-300 transition-colors">
                  <MapPin className="w-3.5 h-3.5 text-[#0D4F3C] shrink-0" />
                  <span className="truncate">Deliver to {selectedAddress?.label || 'Home'}: {selectedAddress?.address || selectedAddress?.city || 'Set address'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
