import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../routes';
import { ActivePage, DeliveryZone, UserRole, SavedAddress } from '../../types';
import {
  X,
  MapPin,
  ChevronDown,
  Home,
  Store,
  Search,
  Tag,
  ShoppingBag,
  Heart,
  User,
  HelpCircle,
  Briefcase,
  FileText,
  Shield,
  PhoneCall,
  LogOut,
  LogIn,
  ChefHat,
  ShieldAlert,
  Bike,
  Compass,
  Lock,
  ExternalLink,
  LayoutDashboard,
  FolderTree,
  Layers,
  Boxes,
  Users,
  Star,
  Award,
  CreditCard,
  BarChart3,
  Bell,
  Edit3,
  Globe,
  Settings,
  Terminal,
  ArrowLeft,
  Utensils,
  Plus,
  Trash2
} from 'lucide-react';
import { VeyrangLogo } from '../common/VeyrangLogo';

export const RightDrawer: React.FC = () => {
  const router = useRouter();
  const {
    isRightDrawerOpen,
    setIsRightDrawerOpen,
    activePage,
    setActivePage,
    selectedZone,
    setSelectedZone,
    activeRole,
    setActiveRole,
    orders,
    favourites,
    walletBalanceNGN,
    adminActiveTab,
    setAdminActiveTab,
    selectedAddress,
    setSelectedAddress,
    savedAddresses,
    deliveryZones,
    addSavedAddress,
    deleteSavedAddress,
    setIsAddressModalOpen
  } = useDelivery();

  const { user, logout, setIsAuthModalOpen, openAuthModalForPortal } = useAuth();
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
  const [isAddingDrawerAddr, setIsAddingDrawerAddr] = useState(false);
  const [drawerLabel, setDrawerLabel] = useState('Home');
  const [drawerAddress, setDrawerAddress] = useState('');
  const [drawerApt, setDrawerApt] = useState('');
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Strictly deduplicated address options for the drawer
  const deliveryAddressOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: SavedAddress[] = [];

    const addUnique = (addr: any, fallbackId: string, fallbackLabel: string) => {
      const val = String(addr?.address || '').trim();
      if (!val) return;
      const key = val.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        options.push({
          id: addr.id || fallbackId,
          label: addr.label || fallbackLabel,
          address: val,
          apartment: addr.apartment || '',
          city: addr.city || 'Akure',
          isDefault: Boolean(addr.isDefault)
        });
      }
    };

    if (selectedAddress?.address) {
      addUnique(selectedAddress, 'selected-addr', 'Selected address');
    }
    (savedAddresses || []).forEach((a, i) => addUnique(a, a.id || `saved-addr-${i}`, a.label || 'Home'));
    if (user?.address) {
      addUnique({ address: user.address }, 'profile-addr', 'Default Address');
    }

    return options;
  }, [savedAddresses, selectedAddress, user?.address]);

  if (!isRightDrawerOpen) return null;

  const getPageHref = (page: ActivePage) => {
    switch (page) {
      case 'home':
      case 'landing':
        return ROUTES.HOME;
      case 'restaurants':
        return ROUTES.RESTAURANTS;
      case 'search':
        return ROUTES.SEARCH;
      case 'offers':
        return ROUTES.OFFERS;
      case 'orders':
        return ROUTES.ORDERS;
      case 'favourites':
        return ROUTES.FAVOURITES;
      case 'account':
        return ROUTES.ACCOUNT;
      case 'help':
        return ROUTES.HELP;
      case 'contact':
        return ROUTES.CONTACT;
      case 'partner':
        return ROUTES.PARTNER;
      case 'terms':
        return ROUTES.TERMS;
      case 'privacy':
        return ROUTES.PRIVACY;
      default:
        return ROUTES.HOME;
    }
  };

  const handleNavigatePage = (page: ActivePage) => {
    setActiveRole('customer');
    if (page === 'home' && !user) {
      setActivePage('landing');
      router.push(ROUTES.HOME);
    } else {
      setActivePage(page);
      if (page === 'home' || page === 'landing') router.push(ROUTES.HOME);
      else if (page === 'restaurants') router.push(ROUTES.RESTAURANTS);
      else if (page === 'search') router.push(ROUTES.SEARCH);
      else if (page === 'offers') router.push(ROUTES.OFFERS);
      else if (page === 'orders') router.push(ROUTES.ORDERS);
      else if (page === 'favourites') router.push(ROUTES.FAVOURITES);
      else if (page === 'account') router.push(ROUTES.ACCOUNT);
      else if (page === 'help') router.push(ROUTES.HELP);
      else if (page === 'contact') router.push(ROUTES.CONTACT);
      else if (page === 'partner') router.push(ROUTES.PARTNER);
      else if (page === 'terms') router.push(ROUTES.TERMS);
      else if (page === 'privacy') router.push(ROUTES.PRIVACY);
    }
    setIsRightDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateAdminTab = (tab: string) => {
    setActiveRole('admin');
    setAdminActiveTab(tab);
    setIsRightDrawerOpen(false);
    router.push(ROUTES.ADMIN_PORTAL);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  const publicStorefrontNav: {
    id: ActivePage;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
  }[] = [
    { id: 'home', label: 'Home Feed', icon: Home },
    { id: 'restaurants', label: 'Restaurants', icon: Store },
    { id: 'search', label: 'Search Dishes & Spots', icon: Search },
    { id: 'offers', label: 'Offers & Promos', icon: Tag },
    { id: 'help', label: 'Help & FAQ', icon: HelpCircle }
  ];

  const privateAccountNav: {
    id: ActivePage;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string | number;
    badgeColor?: string;
    isLocked?: boolean;
  }[] = [
    {
      id: 'orders',
      label: 'My Orders',
      icon: ShoppingBag,
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Active` : (!user ? 'Sign In' : undefined),
      badgeColor: activeOrdersCount > 0 ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-slate-100 text-slate-600',
      isLocked: !user
    },
    {
      id: 'favourites',
      label: 'Favourites',
      icon: Heart,
      badge: favourites.length > 0 ? favourites.length : undefined,
      badgeColor: 'bg-rose-50 text-rose-600',
      isLocked: !user
    },
    {
      id: 'account',
      label: 'Account & Wallet',
      icon: User,
      badge: user ? `₦${walletBalanceNGN.toLocaleString('en-NG')}` : 'Sign In',
      badgeColor: user ? 'bg-[#E8F5EF] text-[#0D4F3C]' : 'bg-slate-100 text-slate-600',
      isLocked: !user
    }
  ];

  const secondaryNav: { id: ActivePage; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'partner', label: 'Partner with us', icon: Briefcase },
    { id: 'terms', label: 'Terms of Service', icon: FileText },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'contact', label: 'Contact Us', icon: PhoneCall }
  ];

  const adminNavGroups = [
    {
      title: 'OVERVIEW',
      items: [{ id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard }]
    },
    {
      title: 'ORDERS & DISPATCH',
      items: [
        { id: 'orders', label: 'Live Orders Management', icon: ShoppingBag },
        { id: 'delivery', label: 'Delivery Zones & Surge', icon: MapPin },
        { id: 'drivers', label: 'Couriers & Drivers Fleet', icon: Bike }
      ]
    },
    {
      title: 'MENU & INVENTORY',
      items: [
        { id: 'menu', label: 'Menu Items & Dishes', icon: Utensils },
        { id: 'categories', label: 'Menu Categories', icon: FolderTree },
        { id: 'addons', label: 'Add-ons & Variations', icon: Layers },
        { id: 'inventory', label: 'Kitchen Availability / Stock', icon: Boxes }
      ]
    },
    {
      title: 'CUSTOMERS & ENGAGEMENT',
      items: [
        { id: 'customers', label: 'Customer Accounts & Wallets', icon: Users },
        { id: 'reviews', label: 'Reviews & Ratings Moderation', icon: Star },
        { id: 'loyalty', label: 'Loyalty Points & Tiers', icon: Award },
        { id: 'promos', label: 'Vouchers & Promo Codes', icon: Tag }
      ]
    },
    {
      title: 'BUSINESS & REVENUE',
      items: [
        { id: 'payments', label: 'Payment Ledger & Transactions', icon: CreditCard },
        { id: 'branches', label: 'Restaurant Branches & Hubs', icon: MapPin },
        { id: 'reports', label: 'Reports & CSV Export', icon: BarChart3 }
      ]
    },
    {
      title: 'COMMUNICATION',
      items: [
        { id: 'notifications', label: 'Push & Broadcast Alerts', icon: Bell },
        { id: 'support', label: 'Customer Support Tickets', icon: HelpCircle }
      ]
    },
    {
      title: 'WEBSITE & MARKETING',
      items: [
        { id: 'cms', label: 'Website Content CMS', icon: Edit3 },
        { id: 'seo', label: 'SEO & Social Share Cards', icon: Globe }
      ]
    },
    {
      title: 'ADMINISTRATION & SYSTEM',
      items: [
        { id: 'staff', label: 'Staff Roles & Access Control', icon: ShieldAlert },
        { id: 'settings', label: 'Platform Financial Settings', icon: Settings },
        { id: 'security', label: 'Security & 2FA Enforcement', icon: Lock },
        { id: 'developer', label: 'Database Developer Console', icon: Terminal },
        { id: 'audit', label: 'Admin Activity Logs', icon: FileText }
      ]
    }
  ];

  const activeZoneConfig = (deliveryZones && deliveryZones.length > 0) ? (deliveryZones.find((z: any) => z.id === selectedZone || z.code === selectedZone) || deliveryZones[0]) : null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Dimmed Backdrop */}
      <div
        onClick={() => setIsRightDrawerOpen(false)}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Right Drawer Panel */}
      <aside className={`relative w-[320px] sm:w-[380px] md:w-[420px] lg:w-[460px] max-w-[92vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 overflow-y-auto no-scrollbar ${
        activeRole !== 'customer' ? 'bg-slate-900 text-slate-100 border-l border-slate-800' : 'bg-white text-slate-900'
      }`}>
        {/* Drawer Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b sticky top-0 z-20 ${
          activeRole !== 'customer' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0D4F3C] text-white flex items-center justify-center font-black">V</div>
            <div>
              <div className="text-sm font-extrabold">
                {activeRole === 'admin' && 'VeyraNG Admin'}
                {activeRole === 'restaurant' && 'Kitchen Merchant Portal'}
                {activeRole === 'courier' && 'Courier Rider Portal'}
                {activeRole === 'customer' && 'VeyraNG'}
              </div>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${activeRole !== 'customer' ? 'text-[#E8C547]' : 'text-slate-400'}`}>
                {activeRole === 'admin' && 'Operations Navigator'}
                {activeRole === 'restaurant' && 'KDS Order Queue'}
                {activeRole === 'courier' && 'Rider Dispatch'}
                {activeRole === 'customer' && 'Food Delivery'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsRightDrawerOpen(false)}
            aria-label="Close menu"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              activeRole !== 'customer' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* ADMIN MODE DRAWER NAVIGATION */}
        {activeRole === 'admin' ? (
          <div className="flex-1 px-4 py-4 space-y-6">
            <div className="p-3.5 bg-[#0D4F3C]/40 border border-[#0D4F3C]/60 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Super Admin Mode</div>
                <div className="text-[11px] text-[#E8C547]">Cloud Services & Media Sync Active</div>
              </div>
            </div>

            {adminNavGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                <div className="px-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  {group.title}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = adminActiveTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateAdminTab(item.id)}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#0D4F3C] text-white shadow-md shadow-[#0D4F3C]/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-850'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={async () => {
                  await logout();
                  setActiveRole('customer');
                  setActivePage('home');
                  router.push(ROUTES.HOME);
                  setIsRightDrawerOpen(false);
                }}
                className="w-full p-3 text-left text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Admin
              </button>
            </div>
          </div>
        ) : activeRole === 'restaurant' ? (
          /* RESTAURANT KITCHEN MODE DRAWER */
          <div className="flex-1 px-4 py-4 space-y-6">
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Merchant Kitchen (KDS)</div>
                <div className="text-[11px] text-emerald-300">Live Orders & Catalog Active</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                KITCHEN MANAGEMENT
              </div>
              <button
                onClick={() => {
                  setIsRightDrawerOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-[#0D4F3C] text-white shadow-md cursor-pointer"
              >
                <ChefHat className="w-4 h-4 shrink-0" />
                <span>Live Kitchen Dashboard</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={async () => {
                  await logout();
                  setActiveRole('customer');
                  setActivePage('home');
                  router.push(ROUTES.HOME);
                  setIsRightDrawerOpen(false);
                }}
                className="w-full p-3 text-left text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Kitchen
              </button>
            </div>
          </div>
        ) : activeRole === 'courier' ? (
          /* COURIER RIDER MODE DRAWER */
          <div className="flex-1 px-4 py-4 space-y-6">
            <div className="p-3.5 bg-sky-950/40 border border-sky-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Courier Rider Dispatch</div>
                <div className="text-[11px] text-sky-300">GPS Transmitter & Orders Active</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                RIDER DISPATCH
              </div>
              <button
                onClick={() => {
                  setIsRightDrawerOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold bg-[#0D4F3C] text-white shadow-md cursor-pointer"
              >
                <Bike className="w-4 h-4 shrink-0" />
                <span>Active Deliveries Console</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={async () => {
                  await logout();
                  setActiveRole('customer');
                  setActivePage('home');
                  router.push(ROUTES.HOME);
                  setIsRightDrawerOpen(false);
                }}
                className="w-full p-3 text-left text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Rider Portal
              </button>
            </div>
          </div>
        ) : (
          /* CUSTOMER STOREFRONT DRAWER NAVIGATION */
          <>
            {/* Deliver to bar inside drawer */}
            {user && (
              <div className="px-4 py-3 bg-[#F8F9FA] border-b border-slate-100">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
                      className="flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-800 hover:border-[#0D4F3C] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-[#0D4F3C] shrink-0" />
                        <span className="text-slate-500 font-normal">Deliver to:</span>
                        <span className="text-slate-900 font-bold truncate">
                          {selectedAddress && selectedAddress.address && selectedAddress.address.trim()
                            ? `${selectedAddress.label || 'Home'}: ${selectedAddress.address.trim()}`
                            : user?.address && user.address.trim()
                            ? user.address.trim()
                            : 'Set Address'}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 ml-1.5 transition-transform ${isZoneDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRightDrawerOpen(false);
                        setIsAddressModalOpen(true);
                      }}
                      className="px-3 py-2.5 rounded-2xl bg-[#E8F5EF] hover:bg-emerald-100 text-[#0D4F3C] text-xs font-bold transition cursor-pointer shrink-0"
                      title="Open full address manager"
                    >
                      Manage
                    </button>
                  </div>

                  {/* Inline Collapsible Section (NOT absolute, so it NEVER overlaps) */}
                  {isZoneDropdownOpen && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-3 text-xs space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Saved Addresses ({deliveryAddressOptions.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingDrawerAddr((prev) => !prev)}
                            className="text-[#0D4F3C] font-bold text-[11px] flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> {isAddingDrawerAddr ? 'Cancel' : 'Add New'}
                          </button>
                        </div>
                      </div>

                      {isAddingDrawerAddr && (
                        <div className="p-3 border border-slate-200 rounded-xl space-y-2 bg-slate-50">
                          <input
                            type="text"
                            value={drawerLabel}
                            onChange={(e) => setDrawerLabel(e.target.value)}
                            placeholder="Label (Home, Work)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            value={drawerAddress}
                            onChange={(e) => setDrawerAddress(e.target.value)}
                            placeholder="Street Address (e.g. Akure South)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            value={drawerApt}
                            onChange={(e) => setDrawerApt(e.target.value)}
                            placeholder="Apartment / Suite (Optional)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                          <button
                            disabled={isSavingDrawer || !drawerAddress.trim()}
                            onClick={async () => {
                              setIsSavingDrawer(true);
                              try {
                                const created = await addSavedAddress({
                                  label: drawerLabel || 'Home',
                                  address: drawerAddress.trim(),
                                  apartment: drawerApt.trim(),
                                  city: 'Akure'
                                });
                                setSelectedAddress(created);
                                setIsAddingDrawerAddr(false);
                                setDrawerAddress('');
                                setDrawerApt('');
                                setIsZoneDropdownOpen(false);
                              } catch (err: any) {
                                alert(err?.message || 'Failed to add address');
                              } finally {
                                setIsSavingDrawer(false);
                              }
                            }}
                            className="w-full py-2 bg-[#0D4F3C] hover:bg-[#0A3F30] text-white font-bold rounded-lg text-xs disabled:opacity-50 cursor-pointer"
                          >
                            {isSavingDrawer ? 'Saving...' : 'Save & Select Address'}
                          </button>
                        </div>
                      )}

                      <div className="max-h-56 overflow-y-auto space-y-1.5 py-0.5">
                        {deliveryAddressOptions.map((addr) => {
                          const isSelected =
                            selectedAddress?.id === addr.id ||
                            (selectedAddress?.address &&
                              selectedAddress.address.trim().toLowerCase() === addr.address.trim().toLowerCase());
                          return (
                            <div
                              key={addr.id}
                              onClick={() => {
                                setSelectedAddress(addr);
                                setIsZoneDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl flex items-start justify-between gap-2.5 transition-colors cursor-pointer border ${
                                isSelected
                                  ? 'font-bold text-[#0D4F3C] bg-[#E8F5EF] border-emerald-300'
                                  : 'text-slate-700 bg-slate-50/50 border-slate-100 hover:bg-[#E8F5EF]/40'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold">{addr.label || 'Saved address'}</span>
                                  {isSelected && (
                                    <span className="text-[9px] font-extrabold text-[#0D4F3C] bg-white px-1.5 py-0.2 rounded-full border border-emerald-200">
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-normal whitespace-normal break-words mt-0.5">
                                  {addr.address}
                                </div>
                                {(addr.apartment || addr.city) && (
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {[addr.apartment, addr.city].filter(Boolean).join(', ')}
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await deleteSavedAddress(addr.id);
                                }}
                                title="Delete address"
                                aria-label="Delete address"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer self-center"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                        {deliveryAddressOptions.length === 0 && !isAddingDrawerAddr && (
                          <div className="px-3 py-4 text-center text-slate-400 text-xs">
                            No saved addresses yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Navigation Body */}
            <div className="flex-1 px-3.5 py-3 space-y-4">
              {/* Section 1: Public Storefront */}
              <div>
                <div className="space-y-1">
                  {publicStorefrontNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeRole === 'customer' && activePage === item.id;

                    return (
                      <Link
                        key={item.id}
                        href={getPageHref(item.id)}
                        prefetch={true}
                        onClick={() => handleNavigatePage(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 sm:py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#E8F5EF] text-[#0D4F3C] font-bold border-l-4 border-[#0D4F3C] shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-[#0D4F3C]' : 'text-slate-500'
                          }`}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              item.badgeColor || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && !item.badge && (
                          <span className="w-2 h-2 rounded-full bg-[#0D4F3C]" aria-hidden="true" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Private User Account */}
              <div className="pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  {privateAccountNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeRole === 'customer' && activePage === item.id;

                    return (
                      <Link
                        key={item.id}
                        href={getPageHref(item.id)}
                        prefetch={true}
                        onClick={(e) => {
                          if (item.isLocked) {
                            e.preventDefault();
                            setIsRightDrawerOpen(false);
                            setIsAuthModalOpen(true);
                            return;
                          }
                          handleNavigatePage(item.id);
                        }}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 sm:py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#E8F5EF] text-[#0D4F3C] font-bold border-l-4 border-[#0D4F3C] shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-[#0D4F3C]' : 'text-slate-500'
                          }`}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              item.badgeColor || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isActive && !item.badge && (
                          <span className="w-2 h-2 rounded-full bg-[#0D4F3C]" aria-hidden="true" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Legal & Static Information */}
              <div className="pt-2 border-t border-slate-100">
                <div className="space-y-0.5">
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeRole === 'customer' && activePage === item.id;

                    return (
                      <Link
                        key={item.id}
                        href={getPageHref(item.id)}
                        prefetch={true}
                        onClick={() => handleNavigatePage(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#E8F5EF] text-[#0D4F3C] font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#0D4F3C]' : 'text-slate-400'
                          }`}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: User Session / Auth */}
              <div className="pt-2 border-t border-slate-100">
                {user ? (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0D4F3C] text-white font-bold text-xs flex items-center justify-center">
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{user.name || user.email?.split('@')[0] || 'User'}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{user.email}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md bg-[#E8F5EF] text-[#0D4F3C]">
                        {user.role}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsRightDrawerOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsRightDrawerOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full py-3 px-4 bg-[#0D4F3C] hover:bg-[#0A3F30] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Sign In or Register</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
