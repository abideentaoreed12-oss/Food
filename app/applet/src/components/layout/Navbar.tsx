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

  const deliveryAddressOptions = (() => {
    const options = [...(savedAddresses || [])];
    const addIfMissing = (address: any, fallbackId: string, fallbackLabel: string) => {
      const value = String(address?.address || '').trim();
      if (!value) return;
      const exists = options.some((item) => String(item.address || '').trim().toLowerCase() === value.toLowerCase());
      if (!exists) options.unshift({
        id: address.id || fallbackId,
        label: address.label || fallbackLabel,
        address: value,
        apartment: address.apartment || '',
        city: address.city || '',
        isDefault: true
      } as any);
    };
    addIfMissing(selectedAddress, 'active-selected-address', 'Selected address');
    addIfMissing({ address: user?.address }, 'profile-address', 'Profile address');
    return options.filter((addr) => Boolean(addr.address && String(addr.address).trim()));
  })();

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
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </div>
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 text-xs text-slate-800">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-bold text-slate-900">{displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setActivePage('account'); closeDropdowns(); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-medium text-slate-700 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#0D4F3C]" /> Account &amp; Wallet
                    </button>
                    <button
                      onClick={async () => { await logout(); closeDropdowns(); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <VeyrangLogo iconSize="md" textSize="md" isLanding={isLanding} />
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className={`relative p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                    isLanding
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                  aria-label="Open Cart"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {totalCartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                      {totalCartCount}
                    </span>
                  )}
                </button>
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
              <div className="pb-2.5 -mt-1 relative">
                <button
                  type="button"
                  onClick={toggleZoneDropdown}
                  className="inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-[#E8F5EF] hover:border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#0D4F3C] shrink-0" />
                  <span className="truncate">Deliver to {selectedAddress?.label || 'Home'}: {selectedAddress?.address || selectedAddress?.city || 'Set address'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>
                {isZoneDropdownOpen && (
                  <>
                    <div onClick={closeDropdowns} className="fixed inset-0 z-30 bg-black/5" />
                    <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 py-2 text-xs">
                      <div className="px-3.5 py-2 flex items-center justify-between border-b border-slate-100">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Saved Addresses</span>
                        <button
                          onClick={() => setIsAddingAddress((prev) => !prev)}
                          className="text-[#0D4F3C] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> {isAddingAddress ? 'Cancel' : 'Add New'}
                        </button>
                      </div>
                      {isAddingAddress && (
                        <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50">
                          <input
                            type="text"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="Label (Home, Work)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                            placeholder="Street Address (e.g. 15 Admiralty Way)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            value={newApartment}
                            onChange={(e) => setNewApartment(e.target.value)}
                            placeholder="Apartment / Suite (Optional)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <button
                            disabled={isSavingAddress || !newAddress.trim()}
                            onClick={async () => {
                              setIsSavingAddress(true);
                              try {
                                const created = await addSavedAddress({
                                  label: newLabel || 'Home',
                                  address: newAddress.trim(),
                                  apartment: newApartment.trim(),
                                  city: newCity || 'Lagos'
                                });
                                setSelectedAddress(created);
                                setIsAddingAddress(false);
                                setNewAddress('');
                                setNewApartment('');
                                setIsZoneDropdownOpen(false);
                              } catch (err: any) {
                                alert(err?.message || 'Failed to add address');
                              } finally {
                                setIsSavingAddress(false);
                              }
                            }}
                            className="w-full py-2 bg-[#0D4F3C] hover:bg-[#0A3F30] text-white font-bold rounded-lg text-xs disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingAddress ? 'Saving...' : 'Save & Select Address'}
                          </button>
                        </div>
                      )}
                      <div className="max-h-60 overflow-y-auto py-1">
                        {deliveryAddressOptions.map((addr) => {
                          const isSelected = selectedAddress?.id === addr.id || selectedAddress?.address?.trim().toLowerCase() === addr.address.trim().toLowerCase();
                          return (
                            <button
                              key={addr.id || addr.address}
                              onClick={() => {
                                setSelectedAddress(addr);
                                setIsZoneDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-2 hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                                isSelected ? 'bg-emerald-50 text-[#0D4F3C] font-bold' : 'text-slate-700'
                              }`}
                            >
                              <div>
                                <div className="font-semibold">{addr.label || 'Home'}</div>
                                <div className="text-[11px] text-slate-500">{addr.address}</div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#0D4F3C] shrink-0" />}
                            </button>
                          );
                        })}
                        {deliveryAddressOptions.length === 0 && !isAddingAddress && (
                          <div className="px-3.5 py-4 text-center text-slate-500">
                            No saved addresses yet. Click "Add New" above.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
};
