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
import { VeyrangLogo } from '../common/VeyrangLogo.tsx';
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

  // Add Address Form State
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

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-100 shadow-xs">

      {/* Invisible backdrop to dismiss open user dropdown when clicking outside */}
      {isUserDropdownOpen && (
        <div
          onClick={closeDropdowns}
          className="fixed inset-0 z-40 bg-black/5 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Brand Logo & Desktop Nav & Cart/Menu Triggers */}
        <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Desktop Links */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                closeDropdowns();
                setActiveRole('customer');
                setActivePage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="focus-visible:outline-none focus:outline-none border-none outline-none active:scale-95 transition-transform"
            >
              <VeyrangLogo iconSize="md" textSize="md" />
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-2">
              <button
                onClick={() => {
                  closeDropdowns();
                  setActiveRole('customer');
                  setActivePage('home');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeRole === 'customer' && activePage === 'home'
                    ? 'bg-[#FFF1E8] text-[#FF5500]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  closeDropdowns();
                  setActiveRole('customer');
                  setActivePage('restaurants');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeRole === 'customer' && activePage === 'restaurants'
                    ? 'bg-[#FFF1E8] text-[#FF5500]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Restaurants
              </button>
              <button
                onClick={() => {
                  closeDropdowns();
                  setActiveRole('customer');
                  setActivePage('offers');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeRole === 'customer' && activePage === 'offers'
                    ? 'bg-[#FFF1E8] text-[#FF5500]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Offers
              </button>
              <button
                onClick={() => {
                  closeDropdowns();
                  setActiveRole('customer');
                  setActivePage('orders');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeRole === 'customer' && activePage === 'orders'
                    ? 'bg-[#FFF1E8] text-[#FF5500]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                My Orders
              </button>
            </nav>
          </div>

          {/* Right Action Icons: [ Shopping Cart ] [ Sign In / User Profile ] [ Hamburger Menu ] */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 1. Shopping Cart Icon Trigger */}
            <button
              onClick={() => {
                closeDropdowns();
                setIsCartOpen(true);
              }}
              aria-label={`Cart with ${totalCartCount} items`}
              className="relative p-2 text-slate-900 hover:text-[#FF5500] hover:bg-orange-50/70 rounded-full transition-colors cursor-pointer flex items-center justify-center"
            >
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#FF5500] text-white text-[11px] font-extrabold rounded-full flex items-center justify-center shadow-xs">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* 2. Sign In / User Profile Pill */}
            <div className="relative">
              <button
                onClick={() => {
                  if (user) {
                    toggleUserDropdown();
                  } else {
                    closeDropdowns();
                    setIsAuthModalOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 focus:outline-none cursor-pointer active:scale-95 transition-all"
              >
                {user ? (
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-orange-200 bg-[#FFF1E8]/80 hover:bg-[#FFF1E8] text-slate-900 transition-all shadow-2xs">
                    <div className="w-6 h-6 rounded-full font-extrabold text-[11px] flex items-center justify-center shrink-0 bg-[#FF5500] text-white shadow-2xs">
                      {initials}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[80px] sm:max-w-none">Hi, {firstName}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#FF5500] stroke-[2.5] shrink-0" />
                  </div>
                ) : (
                  <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs sm:text-sm font-bold transition-all shadow-xs hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    <span>Sign In</span>
                  </div>
                )}
              </button>

              {/* User Profile Dropdown Menu */}
              {isUserDropdownOpen && user && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 py-2 text-xs animate-in fade-in">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                    <p className="font-bold text-slate-900 truncate">{displayName}</p>
                    <p className="text-[11px] text-slate-500 truncate font-mono">{user.email}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-[#FF5500] px-2 py-0.5 rounded-md">
                      {user.role}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        closeDropdowns();
                        setIsWalletModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#FFF1E8]/50 flex items-center justify-between text-slate-700 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#FF5500]" />
                        <span>In-App Wallet</span>
                      </span>
                      <span className="font-bold font-mono text-emerald-600">
                        ₦{walletBalanceNGN.toLocaleString('en-NG')}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        closeDropdowns();
                        setActiveRole('customer');
                        setActivePage('orders');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#FFF1E8]/50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4 text-slate-500" />
                      <span>My Past Orders</span>
                    </button>

                    <button
                      onClick={() => {
                        closeDropdowns();
                        setActiveRole('customer');
                        setActivePage('account');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#FFF1E8]/50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Profile & Addresses</span>
                    </button>

                    {['admin', 'sub_admin', 'restaurant', 'courier'].includes(user.role) && (() => {
                      let label = 'Admin Console';
                      let badge = 'A-Z Master';
                      let targetRole: 'admin' | 'restaurant' | 'courier' = 'admin';
                      let IconComponent = ShieldAlert;
                      let textClass = 'text-amber-600 hover:text-amber-700';

                      if (user.role === 'sub_admin') {
                        label = 'Admin Console';
                        badge = 'Sub Admin';
                        targetRole = 'admin';
                        textClass = 'text-indigo-600 hover:text-indigo-700';
                      } else if (user.role === 'restaurant') {
                        label = 'Kitchen Portal';
                        badge = 'Merchant';
                        targetRole = 'restaurant';
                        IconComponent = ChefHat;
                        textClass = 'text-emerald-600 hover:text-emerald-700';
                      } else if (user.role === 'courier') {
                        label = 'Rider Portal';
                        badge = 'Courier';
                        targetRole = 'courier';
                        textClass = 'text-sky-600 hover:text-sky-700';
                      }

                      return (
                        <button
                          onClick={() => {
                            closeDropdowns();
                            setActiveRole(targetRole);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between border-t border-slate-100 mt-1 cursor-pointer font-bold ${textClass}`}
                        >
                          <span className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4 shrink-0" />
                            <span>{label}</span>
                          </span>
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 uppercase tracking-wide">
                            {badge}
                          </span>
                        </button>
                      );
                    })()}
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      onClick={async () => {
                        closeDropdowns();
                        await logout();
                        setActiveRole('customer');
                        setActivePage('home');
                      }}
                      className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Hamburger Menu Icon Trigger */}
            <button
              onClick={() => {
                closeDropdowns();
                setIsRightDrawerOpen(true);
              }}
              aria-label="Open navigation menu with all pages"
              className="group relative p-2 text-slate-900 hover:text-[#FF5500] hover:bg-orange-50/70 rounded-full transition-colors cursor-pointer flex items-center justify-center"
              title="Open Menu"
            >
              <div className="flex flex-col justify-center items-center gap-1 w-5 h-4.5">
                <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#FF5500] rounded-full transition-colors" />
                <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#FF5500] rounded-full transition-colors" />
                <span className="w-5 h-[2.5px] bg-slate-900 group-hover:bg-[#FF5500] rounded-full transition-colors" />
              </div>
            </button>
          </div>
        </div>

        {/* Row 2: Delivery Location Bar */}
        <div className="pb-2 pt-0.5 flex items-center justify-start border-t border-slate-100 sm:border-0 relative">

          {/* Right: Deliver to Address Location Button */}
          {user && (
            <div className="relative min-w-0 animate-in fade-in">
              <button
                onClick={toggleZoneDropdown}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-2xs hover:border-[#FF5500] hover:bg-[#FFF1E8]/20 transition-all cursor-pointer text-xs sm:text-sm font-medium text-slate-900 max-w-[200px] xs:max-w-[240px] sm:max-w-[300px]"
              >
                <MapPin className="w-4 h-4 text-[#FF5500] shrink-0" />
                <span className="truncate font-semibold text-slate-800 text-[11px] sm:text-xs">
                  {selectedAddress && selectedAddress.address && selectedAddress.address.trim()
                    ? `Deliver to ${selectedAddress.label || 'Home'}: ${selectedAddress.address.trim().split(',')[0]}`
                    : user?.address && user.address.trim()
                    ? `Deliver to ${user.address.trim().split(',')[0]}`
                    : 'Set Delivery Address'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-0.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Modal for User Saved Delivery Addresses & Adding New Addresses */}
      {isZoneDropdownOpen && user && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[88vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-extrabold font-display text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#FF5500]" />
                  <span>Delivery Address</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose your active address for real-time distance & instant delivery
                </p>
              </div>
              <button
                onClick={closeDropdowns}
                aria-label="Close delivery location modal"
                className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Saved Addresses List */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* User Saved Addresses */}
              {(() => {
                const displayAddresses = [...savedAddresses];
                
                // If there's an active selectedAddress in context that's not in the savedAddresses list, inject it dynamically
                if (selectedAddress && selectedAddress.address && selectedAddress.address.trim()) {
                  const trimmedSelected = selectedAddress.address.trim().toLowerCase();
                  const exists = displayAddresses.some((a) => (a.address || '').trim().toLowerCase() === trimmedSelected);
                  if (!exists) {
                    displayAddresses.unshift({
                      id: selectedAddress.id || 'addr-active-selected',
                      label: selectedAddress.label || 'Active Address',
                      address: selectedAddress.address,
                      apartment: selectedAddress.apartment || '',
                      city: selectedAddress.city || 'Lagos',
                      isDefault: true
                    });
                  }
                }

                // If user has a default profile address not in savedAddresses, inject it dynamically
                if (user?.address && user.address.trim()) {
                  const trimmedProfile = user.address.trim().toLowerCase();
                  const exists = displayAddresses.some((a) => (a.address || '').trim().toLowerCase() === trimmedProfile);
                  if (!exists) {
                    displayAddresses.unshift({
                      id: 'addr-default-profile',
                      label: 'Default Address',
                      address: user.address.trim(),
                      apartment: '',
                      city: 'Lagos',
                      isDefault: displayAddresses.length === 0
                    });
                  }
                }

                if (displayAddresses.length > 0) {
                  return (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        Your Saved Locations ({displayAddresses.length})
                      </div>
                      {displayAddresses.map((addr) => {
                        const isSelected = selectedAddress?.address === addr.address || selectedAddress?.id === addr.id;
                        const IconComp =
                          addr.label.toLowerCase().includes('home')
                            ? Home
                            : addr.label.toLowerCase().includes('work') || addr.label.toLowerCase().includes('office')
                            ? Building
                            : Navigation;

                        return (
                          <div
                            key={addr.id}
                            onClick={() => {
                              setSelectedAddress(addr);
                              closeDropdowns();
                            }}
                            className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-[#FFF1E8] border-[#FF5500] text-[#FF5500] shadow-xs ring-1 ring-[#FF5500]/30'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                  isSelected ? 'bg-orange-100 text-[#FF5500]' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-sm flex items-center gap-2">
                                  <span>{addr.label}</span>
                                  {isSelected && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF5500] text-white">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-700 font-medium truncate mt-0.5">
                                  {addr.address}
                                </p>
                                {(addr.apartment || addr.city) && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {[addr.apartment, addr.city].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 mt-1">
                              {isSelected && (
                                <div className="text-[#FF5500]">
                                  <CheckCircle2 className="w-5 h-5 fill-orange-100" />
                                </div>
                              )}
                              {/* Only show delete option for user-created addresses, not default profile-injected fallbacks */}
                              {addr.id !== 'addr-default-profile' && addr.id !== 'addr-active-selected' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSavedAddress(addr.id);
                                  }}
                                  title="Delete address"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  <div className="text-center py-6 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                    <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">No saved addresses yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add your delivery address below for live road distance calculation.
                    </p>
                  </div>
                );
              })()}

              {/* Add New Address Form Section */}
              <div className="border-t border-slate-100 pt-3">
                {!isAddingAddress ? (
                  <button
                    onClick={() => {
                      if (!user) {
                        closeDropdowns();
                        setIsAuthModalOpen(true);
                      } else {
                        setIsAddingAddress(true);
                      }
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-[#FF5500] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Delivery Address</span>
                  </button>
                ) : (
                  <div className="p-1 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in">
                    <ProAddressForm
                      onSave={async (formData) => {
                        setIsSavingAddress(true);
                        try {
                          await addSavedAddress({
                            label: formData.label,
                            address: formData.address,
                            apartment: formData.apartment,
                            city: formData.city,
                            isDefault: formData.isDefault
                          });
                          setIsAddingAddress(false);
                          closeDropdowns();
                        } catch (err: any) {
                          console.error('Failed to save address:', err);
                        } finally {
                          setIsSavingAddress(false);
                        }
                      }}
                      onCancel={() => setIsAddingAddress(false)}
                      isSubmitting={isSavingAddress}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
