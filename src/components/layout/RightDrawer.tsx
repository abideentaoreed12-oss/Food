import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { DELIVERY_ZONES } from '../../utils/format';
import { ActivePage, DeliveryZone, UserRole } from '../../types';
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
  Utensils
} from 'lucide-react';
import { VeyrangLogo } from '../common/VeyrangLogo.tsx';

export const RightDrawer: React.FC = () => {
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
    selectedAddress
  } = useDelivery();

  const { user, logout, setIsAuthModalOpen } = useAuth();
  const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);

  if (!isRightDrawerOpen) return null;

  const handleNavigatePage = (page: ActivePage) => {
    setActiveRole('customer');
    setActivePage(page);
    setIsRightDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateAdminTab = (tab: string) => {
    setActiveRole('admin');
    setAdminActiveTab(tab);
    setIsRightDrawerOpen(false);
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
    { id: 'offers', label: 'Offers & Promos', icon: Tag, badge: '4 Active', badgeColor: 'bg-orange-100 text-[#FF5500]' },
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
      badgeColor: user ? 'bg-orange-100 text-[#FF5500]' : 'bg-slate-100 text-slate-600',
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
        { id: 'developer', label: 'SQL Developer Console (D1)', icon: Terminal },
        { id: 'audit', label: 'Admin Activity Logs', icon: FileText }
      ]
    }
  ];

  const activeZoneConfig = DELIVERY_ZONES.find((z) => z.id === selectedZone) || DELIVERY_ZONES[0];

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
        activeRole === 'admin' ? 'bg-slate-900 text-slate-100 border-l border-slate-800' : 'bg-white text-slate-900'
      }`}>
        {/* Drawer Header */}
        <div className={`px-5 pt-5 pb-4 flex items-center justify-between border-b sticky top-0 z-20 ${
          activeRole === 'admin' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black">V</div>
            <div>
              <div className="text-sm font-extrabold">{activeRole === 'admin' ? 'VeyraNG Admin' : 'VeyraNG'}</div>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${activeRole === 'admin' ? 'text-orange-400' : 'text-slate-400'}`}>
                {activeRole === 'admin' ? 'Operations Navigator' : 'Food Delivery'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsRightDrawerOpen(false)}
            aria-label="Close menu"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              activeRole === 'admin' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* ADMIN MODE DRAWER NAVIGATION */}
        {activeRole === 'admin' ? (
          <div className="flex-1 px-4 py-4 space-y-6">
            <div className="p-3.5 bg-orange-950/40 border border-orange-500/30 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Super Admin Mode</div>
                <div className="text-[11px] text-orange-300">Platform D1 & R2 Connected</div>
              </div>
              <button
                onClick={() => {
                  setActiveRole('customer');
                  setActivePage('home');
                  setIsRightDrawerOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3 py-1 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Storefront
              </button>
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
                          ? 'bg-[#FF5500] text-white shadow-md shadow-orange-500/25'
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
                  setIsRightDrawerOpen(false);
                }}
                className="w-full p-3 text-left text-rose-400 hover:bg-rose-950/30 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out of Admin
              </button>
            </div>
          </div>
        ) : (
          /* CUSTOMER STOREFRONT DRAWER NAVIGATION */
          <>
            {/* Deliver to bar inside drawer */}
            {user && (
              <div className="px-4 py-3 bg-[#F8F9FA] border-b border-slate-100">
                <div className="relative">
                  <button
                    onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs font-semibold text-slate-800 hover:border-[#FF5500] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-4 h-4 text-[#FF5500] shrink-0" />
                      <span className="text-slate-500 font-normal">Deliver to:</span>
                      <span className="text-slate-900 font-bold truncate">
                        {selectedAddress && selectedAddress.address && selectedAddress.address.trim()
                          ? `${selectedAddress.label || 'Home'}: ${selectedAddress.address.trim().split(',')[0]}`
                          : user?.address && user.address.trim()
                          ? user.address.trim().split(',')[0]
                          : 'Set Address'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
                  </button>

                  {isZoneDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1.5 text-xs">
                      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Select Delivery Zone
                      </div>
                      {DELIVERY_ZONES.map((zone) => (
                        <button
                          key={zone.id}
                          onClick={() => {
                            setSelectedZone(zone.id as DeliveryZone);
                            setIsZoneDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-[#FFF1E8]/50 transition-colors cursor-pointer ${
                            selectedZone === zone.id
                              ? 'font-bold text-[#FF5500] bg-[#FFF1E8]'
                              : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{zone.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{zone.city} · {zone.averageSpeedMin} min ETA</div>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            ₦{zone.deliveryFee} fee
                          </span>
                        </button>
                      ))}
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
                      <button
                        key={item.id}
                        onClick={() => handleNavigatePage(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 sm:py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FFF1E8] text-[#FF5500] font-bold border-l-4 border-[#FF5500] shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-[#FF5500]' : 'text-slate-500'
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
                          <span className="w-2 h-2 rounded-full bg-[#FF5500]" aria-hidden="true" />
                        )}
                      </button>
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
                      <button
                        key={item.id}
                        onClick={() => handleNavigatePage(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 sm:py-3 rounded-2xl text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FFF1E8] text-[#FF5500] font-bold border-l-4 border-[#FF5500] shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-[#FF5500]' : 'text-slate-500'
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
                          <span className="w-2 h-2 rounded-full bg-[#FF5500]" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}

                  {user && ['admin', 'sub_admin', 'restaurant', 'courier'].includes(user.role) && (() => {
                    let label = 'Admin Console';
                    let badge = 'A-Z Master';
                    let buttonClass = 'bg-amber-500/10 text-amber-800 hover:bg-amber-500/20';
                    let badgeClass = 'bg-amber-200 text-amber-900';
                    let IconComponent = ShieldAlert;
                    let iconColorClass = 'text-amber-600';
                    let targetRole: 'admin' | 'restaurant' | 'courier' = 'admin';

                    if (user.role === 'sub_admin') {
                      label = 'Admin Console';
                      badge = 'Sub Admin';
                      buttonClass = 'bg-indigo-500/10 text-indigo-800 hover:bg-indigo-500/20';
                      badgeClass = 'bg-indigo-200 text-indigo-900';
                      IconComponent = ShieldAlert;
                      iconColorClass = 'text-indigo-600';
                      targetRole = 'admin';
                    } else if (user.role === 'restaurant') {
                      label = 'Kitchen Portal';
                      badge = 'Merchant';
                      buttonClass = 'bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20';
                      badgeClass = 'bg-emerald-200 text-emerald-900';
                      IconComponent = ChefHat;
                      iconColorClass = 'text-emerald-600';
                      targetRole = 'restaurant';
                    } else if (user.role === 'courier') {
                      label = 'Rider Portal';
                      badge = 'Courier';
                      buttonClass = 'bg-sky-500/10 text-sky-800 hover:bg-sky-500/20';
                      badgeClass = 'bg-sky-200 text-sky-900';
                      IconComponent = Bike;
                      iconColorClass = 'text-sky-600';
                      targetRole = 'courier';
                    }

                    return (
                      <button
                        onClick={() => {
                          setActiveRole(targetRole);
                          if (targetRole === 'admin') {
                            setAdminActiveTab('dashboard');
                          }
                          setIsRightDrawerOpen(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 sm:py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer mt-1 ${buttonClass}`}
                      >
                        <IconComponent className={`w-5 h-5 shrink-0 ${iconColorClass}`} />
                        <span className="flex-1 text-left">{label}</span>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                          {badge}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Section 3: Legal & Static Information */}
              <div className="pt-2 border-t border-slate-100">
                <div className="space-y-0.5">
                  {secondaryNav.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeRole === 'customer' && activePage === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigatePage(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#FFF1E8] text-[#FF5500] font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#FF5500]' : 'text-slate-400'
                          }`}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
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
                        <div className="w-8 h-8 rounded-full bg-[#FF5500] text-white font-bold text-xs flex items-center justify-center">
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{user.name || user.email?.split('@')[0] || 'User'}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{user.email}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800">
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
                    className="w-full py-3 px-4 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
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
