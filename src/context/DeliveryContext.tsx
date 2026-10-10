import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  UserRole,
  ActivePage,
  Restaurant,
  Order,
  CartItem,
  MenuItem,
  SelectedOption,
  OrderStatus,
  Currency,
  FulfillmentType,
  DeliveryZone,
  SavedAddress
} from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { formatOrderTime } from '../utils/format';

interface DeliveryContextType {
  platformSettings: Record<string, string>;
  deliveryZones: any[];
  serviceFee: number;
  adminActiveTab: string;
  setAdminActiveTab: (tab: string) => void;
  getCmsText: (key: string, defaultText: string) => string;
  cmsContent: Record<string, string>;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  isRightDrawerOpen: boolean;
  setIsRightDrawerOpen: (open: boolean) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  selectedZone: DeliveryZone;
  setSelectedZone: (z: DeliveryZone) => void;
  savedAddresses: SavedAddress[];
  selectedAddress: SavedAddress;
  setSelectedAddress: (addr: SavedAddress) => void;
  addSavedAddress: (newAddr: { label?: string; address: string; apartment?: string; city?: string; isDefault?: boolean }) => Promise<SavedAddress>;
  deleteSavedAddress: (id: string) => Promise<void>;
  restaurants: Restaurant[];
  selectedRestaurantId: string | null;
  setSelectedRestaurantId: (id: string | null) => void;
  selectedRestaurantForPortal: string;
  setSelectedRestaurantForPortal: (id: string) => void;
  customizingItem: MenuItem | null;
  openCustomizer: (item: MenuItem) => void;
  closeCustomizer: () => void;
  cart: CartItem[];
  cartRestaurant: Restaurant | null;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  fulfillmentType: FulfillmentType;
  setFulfillmentType: (type: FulfillmentType) => void;
  scheduledSlot: string;
  setScheduledSlot: (slot: string) => void;
  isContactless: boolean;
  setIsContactless: (contactless: boolean) => void;
  appliedPromo: { code: string; discountAmount: number; description: string } | null;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  useWalletCredit: boolean;
  setUseWalletCredit: (use: boolean) => void;
  walletBalanceNGN: number;
  walletDeposits: WalletDepositRecord[];
  topUpWallet: (amountNGN: number) => void;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  favourites: string[];
  toggleFavourite: (id: string) => void;
  isFavourite: (id: string) => boolean;
  addToCart: (item: MenuItem, quantity: number, options?: SelectedOption[], instructions?: string) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartConflict: {
    newItem: MenuItem;
    quantity: number;
    options: SelectedOption[];
    instructions?: string;
    newRestaurantName: string;
  } | null;
  cancelCartConflict: () => void;
  confirmCartConflict: () => void;
  reorderPastOrder: (order: Order) => void;
  orders: Order[];
  activeTrackingOrderId: string | null;
  activeTrackingOrder: Order | null;
  isTrackingModalOpen: boolean;
  openTracking: (orderId: string) => void;
  closeTracking: () => void;
  placeOrder: (details: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerApartment?: string;
    customerLat?: number;
    customerLng?: number;
    deliveryNotes?: string;
    tip: number;
    paymentMethod: string;
    deliveryFee?: number;
    drivingMinutes?: number;
  }) => Promise<Order>;
  advanceOrderStatus: (orderId: string, newStatus: OrderStatus, note?: string) => Promise<void>;
  verifyOrderHandover: (orderId: string, pin: string) => Promise<boolean>;
  adjustOrderPrepTime: (orderId: string, minutes: number) => Promise<void>;
  refundOrder: (orderId: string, amount: number, reason: string) => Promise<void>;
  updateItemAvailability: (restaurantId: string, itemId: string, isAvailable: boolean) => Promise<void>;
  setBusyMode: (restaurantId: string, isBusy: boolean) => Promise<void>;
  sendChatMessage: (orderId: string, text: string, sender?: 'customer' | 'courier') => Promise<void>;
  refreshData: () => Promise<void>;
}

export interface WalletDepositRecord {
  id: string;
  type: 'deposit' | 'order' | 'refund' | 'bonus';
  title: string;
  description: string;
  reference: string;
  amount: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  paymentMethod?: string;
}

const DeliveryContext = createContext<DeliveryContextType | undefined>(undefined);

const EMPTY_ADDRESS: SavedAddress = {
  id: '',
  label: '',
  address: '',
  apartment: '',
  city: '',
  isDefault: false
};

export const DeliveryProvider: React.FC<{ children: React.ReactNode; initialRole?: UserRole }> = ({ children, initialRole }) => {
  const { user, setIsAuthModalOpen, refreshUser, openAuthModalForPortal } = useAuth();

  const [activeRole, setActiveRoleState] = useState<UserRole>(initialRole || 'customer');

  // Check URL pathname for /admin on client mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      setActiveRoleState('admin');
    }
  }, []);

  // Automatically lock and synchronize activeRole to user's authenticated role
  useEffect(() => {
    if (user) {
      if (user.role === 'restaurant') {
        setActiveRoleState('restaurant');
      } else if (user.role === 'courier') {
        setActiveRoleState('courier');
      } else if (user.role === 'admin' || user.role === 'sub_admin') {
        setActiveRoleState('admin');
      } else {
        setActiveRoleState('customer');
      }
    } else {
      setActiveRoleState('customer');
    }
  }, [user]);

  const setActiveRole = useCallback((role: UserRole) => {
    if (user) {
      // Locked to the authenticated role: users can only see their own assigned portal
      if (user.role === 'restaurant') {
        setActiveRoleState('restaurant');
        return;
      }
      if (user.role === 'courier') {
        setActiveRoleState('courier');
        return;
      }
      if (user.role === 'admin' || user.role === 'sub_admin') {
        setActiveRoleState('admin');
        return;
      }
      setActiveRoleState('customer');
      return;
    }

    // Unauthenticated public visitors: can only view customer storefront
    if (role !== 'customer') {
      openAuthModalForPortal(role);
      return;
    }
    setActiveRoleState('customer');
  }, [user, openAuthModalForPortal]);

  const [activePage, setActivePageState] = useState<ActivePage>('landing');

  // Restore saved active page on client mount after hydration
  useEffect(() => {
    try {
      const savedPage = localStorage.getItem('veyrang_active_page');
      if (savedPage) setActivePageState(savedPage as ActivePage);
    } catch {}
  }, []);

  const setActivePage = useCallback((page: ActivePage) => {
    setActivePageState(page);
    try { localStorage.setItem('veyrang_active_page', page); } catch {}
  }, []);

  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState<boolean>(false);
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [selectedZone, setSelectedZone] = useState<DeliveryZone>('LEKKI');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('delivery');

  useEffect(() => {
    try {
      const savedCurrency = localStorage.getItem('veyrang_currency');
      if (savedCurrency) setCurrency(savedCurrency as Currency);
      const savedZone = localStorage.getItem('veyrang_selected_zone');
      if (savedZone) setSelectedZone(savedZone as DeliveryZone);
      const savedFulfillment = localStorage.getItem('veyrang_fulfillment_type');
      if (savedFulfillment) setFulfillmentType(savedFulfillment as FulfillmentType);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('veyrang_currency', currency); } catch {}
  }, [currency]);

  useEffect(() => {
    try { localStorage.setItem('veyrang_selected_zone', selectedZone); } catch {}
  }, [selectedZone]);

  useEffect(() => {
    try { localStorage.setItem('veyrang_fulfillment_type', fulfillmentType); } catch {}
  }, [fulfillmentType]);
  
  const [walletDeposits, setWalletDeposits] = useState<WalletDepositRecord[]>([]);
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({
    currency_ngn_usd_rate: '1400',
    platform_commission_percent: '15',
    base_service_fee_ngn: '500',
    base_service_fee_usd: '1.99',
    minimum_order_ngn: '2500',
    minimum_order_usd: '10.00'
  });
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [adminActiveTab, setAdminActiveTab] = useState<string>('dashboard');

  // Dynamic Service Fee calculated from D1 live settings based on current currency
  const serviceFee = currency === 'USD'
    ? Number(platformSettings.base_service_fee_usd || 1.99)
    : Number(platformSettings.base_service_fee_ngn || 500);
  
  // D1-Authoritative Saved Addresses & Guest Persistent Delivery Address
  // D1-Authoritative Saved Addresses associated exclusively by user account, not by browser cache
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddressState] = useState<SavedAddress>(EMPTY_ADDRESS);

  const setSelectedAddress = useCallback(async (addr: SavedAddress) => {
    setSelectedAddressState(addr);
    if (user && addr.address) {
      try {
        await api.auth.updateProfile({ address: addr.address });
        await refreshUser();
      } catch (err) {
        console.warn('Failed to update primary address on select:', err);
      }
    }
  }, [user, refreshUser]);

  const syncUserAddresses = useCallback(async (currUser: any, d1Addresses: any[]) => {
    if (!currUser) {
      setSavedAddresses([]);
      setSelectedAddressState(EMPTY_ADDRESS);
      return;
    }
    
    if (Array.isArray(d1Addresses)) {
      const list: SavedAddress[] = d1Addresses.map((a: any) => ({
        id: a.id || `addr-${Date.now()}`,
        label: a.label || 'Home',
        address: a.address,
        apartment: a.apartment || '',
        city: a.city || 'Lagos',
        isDefault: Boolean(a.isDefault)
      }));

      // Inject default profile address if set and not in the list
      if (currUser.address && currUser.address.trim()) {
        const trimmedProfile = currUser.address.trim().toLowerCase();
        const exists = list.some((a) => (a.address || '').trim().toLowerCase() === trimmedProfile);
        if (!exists) {
          list.unshift({
            id: 'addr-default-profile',
            label: 'Default Address',
            address: currUser.address.trim(),
            apartment: '',
            city: 'Lagos',
            isDefault: list.length === 0
          });
        }
      }

      setSavedAddresses(list);
      const def = list.find((a) => a.isDefault) || list[0] || EMPTY_ADDRESS;
      setSelectedAddressState(def);
    }
  }, []);

  // Sync strictly with Platform D1 per authenticated user
  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      setSelectedAddressState(EMPTY_ADDRESS);
      return;
    }

    let isMounted = true;
    api.auth.getAddresses().then(async (res: any) => {
      if (!isMounted) return;
      const list = res?.data || res || [];
      await syncUserAddresses(user, list);
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id, syncUserAddresses]);

  // Permanently add a new delivery address directly to Platform D1
  const addSavedAddress = useCallback(
    async (newAddr: { label?: string; address: string; apartment?: string; city?: string; isDefault?: boolean }): Promise<SavedAddress> => {
      if (!user) {
        setIsAuthModalOpen(true);
        throw new Error('Please sign in or create an account to save a delivery address');
      }

      const cleanAddress = (newAddr.address || '').trim();
      if (!cleanAddress) {
        throw new Error('Address cannot be empty');
      }

      const created: SavedAddress = {
        id: `addr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: newAddr.label || 'Home',
        address: cleanAddress,
        apartment: newAddr.apartment || '',
        city: newAddr.city || 'Lagos',
        isDefault: true
      };

      setSavedAddresses((prev) => [
        created,
        ...prev.filter((a) => a.address.trim().toLowerCase() !== cleanAddress.toLowerCase()).map((a) => ({ ...a, isDefault: false }))
      ]);
      setSelectedAddressState(created);

      try {
        await api.auth.addAddress({
          label: created.label,
          address: created.address,
          apartment: created.apartment,
          city: created.city,
          isDefault: true
        });
        await refreshUser();
      } catch (err) {
        console.warn('D1 address sync warning:', err);
      }

      return created;
    },
    [user, setIsAuthModalOpen, refreshUser]
  );

  // Permanently delete a saved delivery address directly from Platform D1
  const deleteSavedAddress = useCallback(
    async (id: string) => {
      setSavedAddresses((prev) => {
        const nextList = prev.filter((a) => a.id !== id);
        if (selectedAddress?.id === id) {
          setSelectedAddressState(nextList[0] || EMPTY_ADDRESS);
        }
        return nextList;
      });

      if (user) {
        try {
          await api.auth.deleteAddress(id);
        } catch (err) {
          console.warn('D1 address delete warning:', err);
        }
      }
    },
    [user, selectedAddress]
  );

  const [cmsContent, setCmsContent] = useState<Record<string, string>>({});

  useEffect(() => {
    api.admin.getCMS?.().then((res: any) => {
      if (res) setCmsContent(res);
    }).catch(() => {});
  }, []);

  const getCmsText = useCallback((key: string, defaultText: string): string => {
    return platformSettings[key] || cmsContent[key] || defaultText;
  }, [platformSettings, cmsContent]);

  // Server-managed catalog & server-managed orders
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Cart persistence (loads from localStorage so guests & users never lose items)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartLoaded, setIsCartLoaded] = useState<boolean>(false);

  // Restore cart on client mount after hydration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('veyrang_cart_v1');
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch {}
    setIsCartLoaded(true);
  }, []);

  const [cartConflict, setCartConflict] = useState<{
    newItem: MenuItem;
    quantity: number;
    options: SelectedOption[];
    instructions?: string;
    newRestaurantName: string;
  } | null>(null);
  const [cartAlert, setCartAlert] = useState<string | null>(null);

  useEffect(() => {
    if (!isCartLoaded) return;
    try {
      localStorage.setItem('veyrang_cart_v1', JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart, isCartLoaded]);

  const [favourites, setFavourites] = useState<string[]>([]);

  const [scheduledSlot, setScheduledSlot] = useState<string>('Today, 6:00 PM – 6:30 PM');
  const [isContactless, setIsContactless] = useState<boolean>(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    description: string;
  } | null>(null);

  const [walletBalanceNGN, setWalletBalanceNGN] = useState<number>(0);
  const [useWalletCredit, setUseWalletCredit] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedRestaurantForPortal, setSelectedRestaurantForPortal] = useState<string>('rest-1');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpenState] = useState<boolean>(false);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<string | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);

  const refreshData = useCallback(async () => {
    try {
      // All shared catalog/settings reads come from the last-known-good snapshot.
      // A failed request preserves the last successful state; it never switches to mock/direct fallback data.
      try {
        const snapRes = await api.siteData.getPublicSnapshot();
        const snap = snapRes?.data || snapRes;
        if (snap && Array.isArray(snap.restaurants)) {
          setRestaurants(snap.restaurants);
          if (Array.isArray(snap.deliveryZones)) setDeliveryZones(snap.deliveryZones);
          if (snap.platformSettings && typeof snap.platformSettings === 'object') {
            setPlatformSettings((prev) => ({ ...prev, ...snap.platformSettings }));
            setCmsContent((prev) => ({ ...prev, ...snap.platformSettings }));
          }

          // Notify other open tabs when the authoritative snapshot version changes.
          if (typeof window !== 'undefined' && Number.isFinite(Number(snap.version))) {
            const version = Number(snap.version);
            const previousVersion = Number(sessionStorage.getItem('veyrang_site_data_version') || 0);
            if (version > previousVersion) {
              sessionStorage.setItem('veyrang_site_data_version', String(version));
              try {
                const channel = new BroadcastChannel('veyrang-site-data');
                channel.postMessage({ type: 'snapshot-updated', version, updatedAt: snap.updatedAt });
                channel.close();
              } catch {}
              window.dispatchEvent(new CustomEvent('veyrang-site-data-updated', {
                detail: { version, updatedAt: snap.updatedAt }
              }));
            }
          }
        } else {
          // No real snapshot yet: don't substitute fabricated records.
          setRestaurants([]);
          setDeliveryZones([]);
        }
      } catch (snapshotError) {
        // Keep the last successfully loaded snapshot in memory; never fall back to mock data.
        console.warn('Unable to refresh the shared site-data snapshot:', snapshotError);
      }

      // Validate cart against fresh restaurant data
      setCart(prevCart => {
        let changed = false;
        const newCart = prevCart.map(item => {
          const rest = restaurants.find(r => r.id === item.menuItem.restaurantId);
          const allItems = (rest as any)?.menuItems || rest?.categories?.flatMap((c) => c.items || []) || [];
          const menuItem = allItems.find((mi: any) => mi.id === item.menuItem.id);
          
          if (menuItem && (menuItem.price !== item.menuItem.price || menuItem.isAvailable !== item.menuItem.isAvailable)) {
            changed = true;
            const optionsTotal = item.selectedOptions.reduce((sum, opt) => sum + opt.price, 0);
            const unitPrice = menuItem.price + optionsTotal;
            return {
              ...item,
              menuItem,
              itemTotal: Math.round(unitPrice * item.quantity)
            };
          }
          return item;
        });
        if (changed) setCartAlert('Some items in your cart have been updated due to price or availability changes.');
        return newCart;
      });

      if (user) {
        const [serverOrders, txRes, addressesRes, meRes] = await Promise.all([
          api.orders.getAll().catch(() => null),
          api.auth.getWalletTransactions().catch(() => null),
          api.auth.getAddresses().catch(() => null),
          api.auth.getMe().catch(() => null)
        ]);
        if (serverOrders && Array.isArray(serverOrders)) {
          setOrders(serverOrders);
        } else {
          setOrders([]);
        }
        const rawTxs = Array.isArray(txRes) ? txRes : (txRes?.data && Array.isArray(txRes.data) ? txRes.data : []);
        if (Array.isArray(rawTxs)) {
          setWalletDeposits(rawTxs.map((tx: any) => ({
            id: tx.id,
            type: (tx.type || (Number(tx.amount || 0) < 0 ? 'order' : 'deposit')) as any,
            title: tx.description || (Number(tx.amount || 0) < 0 ? 'Order Payment' : 'Wallet Deposit'),
            description: tx.description || `Ref: ${tx.reference || tx.id}`,
            reference: tx.reference || tx.id,
            amount: Number(tx.amount || 0),
            timestamp: tx.created_at
              ? formatOrderTime(tx.created_at)
              : 'Recent',
            status: (tx.status || 'completed') as any,
            paymentMethod: tx.payment_method
          })));
        }
        const rawAddresses = Array.isArray(addressesRes) ? addressesRes : (addressesRes?.data && Array.isArray(addressesRes.data) ? addressesRes.data : null);
        if (rawAddresses) {
          await syncUserAddresses(user, rawAddresses);
        }
        const liveUser = (meRes as any)?.data?.user || (meRes as any)?.user;
        if (liveUser && liveUser.walletBalanceNGN !== undefined) {
          setWalletBalanceNGN(Number(liveUser.walletBalanceNGN || 0));
        } else if (user.walletBalanceNGN !== undefined) {
          setWalletBalanceNGN(Number(user.walletBalanceNGN || 0));
        }
        setFavourites([]);
      } else {
        setOrders([]);
        setFavourites([]);
        setWalletDeposits([]);
        setWalletBalanceNGN(0);
        setActiveTrackingOrderId(null);
        setSavedAddresses([]);
        setSelectedAddressState(EMPTY_ADDRESS);
        setCart([]);
      }
    } catch (e) {
      console.warn('Silent sync error:', e);
    }
  }, [user, selectedAddress?.address]);

  // Reconcile Paystack's real transaction reference when the customer returns.
  // The GET endpoint verifies the amount against D1 and marks the associated order paid.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('reference') || urlParams.get('trxref');
    if (!ref) return;

    let cancelled = false;
    (async () => {
      try {
        // Use the existing authenticated payment API route (/api/payment/verify, POST).
        // The previous plural GET URL did not match the app's route and left users on cart.
        const result: any = await api.payment.verify(ref);
        const verified = result?.isPaid === true ||
          result?.status === 'success' ||
          result?.data?.status === 'success' ||
          result?.data?.isPaid === true;
        if (!verified) {
          console.warn('Paystack payment is not yet confirmed:', result?.error || result?.status || 'verification pending');
          return;
        }
        if (cancelled) return;
        if (refreshUser) await refreshUser();
        // Reload server-managed orders and wallet/payment state after verified payment.
        if (typeof refreshData === 'function') await refreshData();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('reference');
        cleanUrl.searchParams.delete('trxref');
        cleanUrl.searchParams.delete('order_id');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      } catch (err) {
        console.warn('Paystack callback reconciliation warning:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshUser, refreshData]);

  // Immediate & Absolute User Data Purge when unauthenticated or on logout event
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setSavedAddresses([]);
      setSelectedAddressState(EMPTY_ADDRESS);
      setCart([]);
      setFavourites([]);
      setWalletDeposits([]);
      setWalletBalanceNGN(0);
      setActiveTrackingOrderId(null);
      setIsCartOpenState(false);
      setIsRightDrawerOpen(false);
      setIsTrackingModalOpen(false);
      setIsWalletModalOpen(false);
      setActiveRole('customer');
      if (['orders', 'account', 'favourites'].includes(activePage)) {
        setActivePage('landing');
      }
      // Do not clear browser storage merely because the initial auth check has not
      // completed or the session endpoint is temporarily unavailable. Explicit logout
      // is handled by the veyrang-user-logout event below.
    }
  }, [user]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      setOrders([]);
      setSavedAddresses([]);
      setSelectedAddressState(EMPTY_ADDRESS);
      setCart([]);
      setFavourites([]);
      setWalletDeposits([]);
      setWalletBalanceNGN(0);
      setActiveTrackingOrderId(null);
      setIsCartOpenState(false);
      setIsRightDrawerOpen(false);
      setIsTrackingModalOpen(false);
      setIsWalletModalOpen(false);
      setActiveRole('customer');
      setActivePage('landing');
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('veyrang_jwt_token');
          localStorage.removeItem('veyrang_user_cache');
          sessionStorage.clear();
        } catch {}
      }
    };

    window.addEventListener('veyrang-user-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('veyrang-user-logout', handleLogoutEvent);
    };
  }, []);

  const refreshDataRef = useRef(refreshData);
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  useEffect(() => {
    // Initial pull plus 10-second polling; this requests the shared last-known-good endpoint only.
    refreshDataRef.current();
    const interval = window.setInterval(() => {
      refreshDataRef.current();
    }, 10000);

    // Fan out snapshot-change notifications to every open tab on this origin.
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('veyrang-site-data');
      channel.onmessage = (event) => {
        if (event.data?.type === 'snapshot-updated') {
          refreshDataRef.current();
        }
      };
    } catch {}

    const handleSnapshotUpdated = () => refreshDataRef.current();
    window.addEventListener('veyrang-site-data-updated', handleSnapshotUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('veyrang-site-data-updated', handleSnapshotUpdated);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    refreshDataRef.current();
  }, [user?.id, selectedAddress?.address]);

  // Cart Opening
  const setIsCartOpen = (open: boolean) => {
    setIsCartOpenState(open);
  };

  const toggleFavourite = (id: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setFavourites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isFavourite = (id: string) => favourites.includes(id);

  const cartRestaurant =
    cart.length > 0 && cart[0]?.menuItem?.restaurantId
      ? restaurants.find((r) => r.id === cart[0].menuItem.restaurantId) || null
      : null;

  const activeTrackingOrder =
    orders.find((o) => o.id === activeTrackingOrderId) || orders[0] || null;

  const openCustomizer = (item: MenuItem) => {
    setCustomizingItem(item);
  };

  const closeCustomizer = () => {
    setCustomizingItem(null);
  };

  const cancelCartConflict = () => {
    setCartConflict(null);
  };

  const confirmCartConflict = () => {
    if (!cartConflict) return;
    const { newItem, quantity, options, instructions } = cartConflict;
    setCartConflict(null);
    setCart([]);
    executeAddToCart(newItem, quantity, options, instructions);
  };

  const addToCart = (
    item: MenuItem,
    quantity: number,
    options: SelectedOption[] = [],
    instructions?: string
  ) => {
    const currentRestId = cart.length > 0 ? cart[0]?.menuItem?.restaurantId : null;
    if (currentRestId && currentRestId !== item.restaurantId) {
      const targetRest = restaurants.find((r) => r.id === item.restaurantId);
      setCartConflict({
        newItem: item,
        quantity,
        options,
        instructions,
        newRestaurantName: targetRest?.name || 'New Kitchen'
      });
      return;
    }

    executeAddToCart(item, quantity, options, instructions);
  };

  const executeAddToCart = (
    item: MenuItem,
    quantity: number,
    options: SelectedOption[] = [],
    instructions?: string
  ) => {
    const optionsTotal = options.reduce((sum, opt) => sum + opt.price, 0);
    const unitPrice = item.price + optionsTotal;

    // Check if an identical item with exact same options & instructions is already in cart
    const optionsSignature = options.map((o) => o.optionId).sort().join('|');

    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => {
        if (ci.menuItem.id !== item.id) return false;
        if ((ci.specialInstructions || '') !== (instructions || '')) return false;
        const ciSig = (ci.selectedOptions || []).map((o) => o.optionId).sort().join('|');
        return ciSig === optionsSignature;
      });

      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + quantity;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          itemTotal: Math.round(unitPrice * newQty)
        };
        return updated;
      }

      const cartItemId = `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newItem: CartItem = {
        cartItemId,
        menuItem: item,
        quantity,
        selectedOptions: options,
        specialInstructions: instructions,
        itemTotal: Math.round(unitPrice * quantity)
      };
      return [...prev, newItem];
    });

    setIsCartOpenState(true);
    setCustomizingItem(null);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            const singlePrice = item.itemTotal / item.quantity;
            return {
              ...item,
              quantity: nextQty,
              itemTotal: Math.round(singlePrice * nextQty)
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedPromo(null);
  };

  const reorderPastOrder = (pastOrder: Order) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setCart([...pastOrder.items]);
    setIsCartOpenState(true);
  };

  const topUpWallet = async (amountNGN: number) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    const cleanAmount = Math.round(amountNGN);
    try {
      const res = await api.auth.topUpWallet(cleanAmount);
      if (res?.data?.walletBalanceNGN !== undefined) {
        setWalletBalanceNGN(res.data.walletBalanceNGN);
      } else {
        setWalletBalanceNGN((prev) => prev + cleanAmount);
      }

      // Re-fetch transactions ledger from live Platform D1
      const txRes = await api.auth.getWalletTransactions().catch(() => null);
      const rawTxs = Array.isArray(txRes) ? txRes : (txRes?.data && Array.isArray(txRes.data) ? txRes.data : []);
      if (Array.isArray(rawTxs)) {
        setWalletDeposits(rawTxs.map((tx: any) => ({
          id: tx.id,
          type: (tx.type || 'deposit') as any,
          title: tx.payment_method ? `Deposit (${tx.payment_method})` : (tx.description || 'Wallet Deposit'),
          description: `Ref: ${tx.reference || tx.id}`,
          reference: tx.reference || tx.id,
          amount: Number(tx.amount || 0),
          timestamp: tx.created_at ? formatOrderTime(tx.created_at) : 'Just now',
          status: (tx.status || 'completed') as any
        })));
      }
    } catch (e: any) {
      console.error('Wallet top-up failed:', e);
      setWalletBalanceNGN((prev) => prev + cleanAmount);
    }
  };

  const applyPromoCode = useCallback(async (code: string): Promise<{ success: boolean; message: string }> => {
    const codeClean = code.trim().toUpperCase();
    const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);

    if (subtotal <= 0) {
      return { success: false, message: 'Please add items to your cart first.' };
    }

    try {
      const res = await api.orders.validatePromo(codeClean, subtotal);
      if (res && res.valid) {
        setAppliedPromo({
          code: codeClean,
          discountAmount: res.discountAmount,
          description: res.description
        });
        return { success: true, message: `Promo applied: ₦${res.discountAmount.toLocaleString('en-NG')} discount!` };
      } else {
        setAppliedPromo(null);
        return { success: false, message: res?.error || `Promo code "${codeClean}" is invalid or expired.` };
      }
    } catch (err: any) {
      setAppliedPromo(null);
      return { success: false, message: err.message || `Promo code "${codeClean}" is invalid or expired.` };
    }
  }, [cart]);

  const removePromoCode = () => {
    setAppliedPromo(null);
  };

  const placeOrder = async (details: {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerApartment?: string;
    customerLat?: number;
    customerLng?: number;
    deliveryNotes?: string;
    tip: number;
    paymentMethod: string;
    deliveryFee?: number;
    drivingMinutes?: number;
  }): Promise<Order> => {
    if (!user) {
      setIsAuthModalOpen(true);
      throw new Error('You must be signed in to place an order');
    }

    if (!cartRestaurant || cart.length === 0) {
      throw new Error('Cart is empty');
    }

    const itemsSubtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
    const deliveryFee = fulfillmentType === 'pickup'
      ? 0
      : (Number.isFinite(Number(details.deliveryFee)) && details.deliveryFee !== undefined
          ? Math.max(0, Number(details.deliveryFee))
          : Math.max(0, Number(cartRestaurant.deliveryFee) || 0));
    // serviceFee dynamically resolved from D1 settings
    const packagingFee = 250;
    const discount = appliedPromo?.discountAmount || 0;
    const grossTotal = itemsSubtotal + deliveryFee + serviceFee + packagingFee + details.tip - discount;

    // Always spend available wallet credit first; debit card covers only the remainder.
    const walletDeduction = Math.min(Math.max(0, Number(walletBalanceNGN) || 0), Math.max(0, grossTotal));
    const finalPayable = Math.max(0, grossTotal - walletDeduction);

    // ETA is based on the live road-routing duration returned by OSRM/Google/etc.
    // Add the agreed 15-minute kitchen/dispatch buffer; never invent a drive time.
    const drivingMinutes = Number(details.drivingMinutes);
    const hasLiveDriveTime = fulfillmentType === 'pickup' || (Number.isFinite(drivingMinutes) && drivingMinutes > 0);
    if (!hasLiveDriveTime) {
      throw new Error('Live driving time is not available yet. Please recalculate your delivery distance before placing the order.');
    }
    const computedETA = fulfillmentType === 'pickup' ? 0 : Math.ceil(drivingMinutes) + 15;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      shortId: `QB-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: details.customerName,
      customerPhone: details.customerPhone,
      customerAddress: details.customerAddress,
      customerApartment: details.customerApartment,
      customerLat: details.customerLat,
      customerLng: details.customerLng,
      deliveryNotes: details.deliveryNotes,
      restaurantId: cartRestaurant.id,
      restaurantName: cartRestaurant.name,
      restaurantAddress: cartRestaurant.address,
      restaurantLat: cartRestaurant.lat,
      restaurantLng: cartRestaurant.lng,
      items: [...cart],
      status: 'placed',
      subtotal: itemsSubtotal,
      deliveryFee,
      serviceFee: serviceFee + packagingFee,
      discountAmount: discount,
      tip: details.tip,
      total: grossTotal,
      currency,
      paymentMethod: details.paymentMethod,
      fulfillmentType,
      scheduledSlot: fulfillmentType === 'scheduled' ? scheduledSlot : undefined,
      isContactless,
      handoverPin: Math.floor(1000 + Math.random() * 9000).toString(),
      estimatedArrivalMinutes: computedETA,
      routeProgress: 5,
      createdAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: 'Order placed by customer'
        }
      ],
      messages: []
    };

    let finalOrder: Order = newOrder;
    let paystackInitializationError: string | null = null;

    try {
      const serverOrder = await api.orders.create({
        customerId: user?.id || undefined,
        customerName: details.customerName,
        customerPhone: details.customerPhone,
        customerEmail: user?.email || undefined,
        customerAddress: details.customerAddress,
        customerApartment: details.customerApartment,
        customerLat: details.customerLat,
        customerLng: details.customerLng,
        deliveryNotes: details.deliveryNotes,
        restaurantId: cartRestaurant.id,
        restaurantName: cartRestaurant.name,
        restaurantAddress: cartRestaurant.address,
        items: cart.map((item) => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.menuItem.price,
          selectedOptions: item.selectedOptions.map((opt) => ({
            groupId: opt.groupId,
            groupName: opt.groupName,
            optionId: opt.optionId,
            optionName: opt.optionName,
            price: Number(opt.price)
          })),
          specialInstructions: item.specialInstructions || '',
          itemTotal: item.itemTotal
        })),
        subtotal: itemsSubtotal,
        deliveryFee,
        serviceFee: serviceFee + packagingFee,
        tip: details.tip,
        total: grossTotal,
        drivingMinutes: fulfillmentType === 'pickup' ? 0 : drivingMinutes,
        paymentMethod: details.paymentMethod,
        currency,
        fulfillmentType,
        scheduledSlot: fulfillmentType === 'scheduled' ? scheduledSlot : undefined,
        isContactless,
        promoCode: appliedPromo?.code,
        walletDeduction,
        estimatedArrivalMinutes: computedETA,
        routeProgress: 5,
        idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      });

      finalOrder = (serverOrder && serverOrder.id) ? serverOrder : newOrder;
      setOrders((prev) => [finalOrder, ...prev.filter((o) => o.id !== finalOrder.id)]);
      setActiveTrackingOrderId(finalOrder.id);

      // Immediately append payment to wallet transaction statement
      const orderTx: WalletDepositRecord = {
        id: `tx-ord-${finalOrder.id}`,
        type: 'order',
        title: `Order Payment — ${cartRestaurant.name}`,
        description: cart.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', ') || 'Food items',
        reference: finalOrder.shortId || finalOrder.id,
        amount: -Math.abs(grossTotal),
        timestamp: formatOrderTime(new Date()),
        status: 'completed',
        paymentMethod: details.paymentMethod
      };
      setWalletDeposits((prev) => [orderTx, ...prev.filter((p) => p.id !== orderTx.id && p.reference !== orderTx.reference)]);

      refreshData().catch(() => {});

      // Paystack-hosted checkout is the only online card processor. Never mark an
      // unpaid card order as successful if initialization fails.
      if (finalPayable > 0 && details.paymentMethod === 'Debit Card') {
        if (!user?.email) {
          paystackInitializationError = 'A valid account email is required to pay securely with Paystack.';
          throw new Error(paystackInitializationError);
        }
        const payRes: any = await api.payment.initialize({
          email: user.email,
          amount: finalPayable,
          callbackUrl: `${window.location.origin}/payment/callback?order_id=${encodeURIComponent(finalOrder.id)}`,
          metadata: { orderId: finalOrder.id, userId: user.id || user.email, type: 'order_payment', provider: 'paystack' }
        }).catch((error: any) => {
          paystackInitializationError = error?.message || 'Paystack could not start the card payment. Please try again.';
          return null;
        });

        // api.payment.initialize uses the shared request helper, which unwraps json.data.
        // Accept the unwrapped payload as well as a wrapped response for compatibility.
        const authorizationUrl = payRes?.authorizationUrl || payRes?.data?.authorizationUrl;
        if (authorizationUrl && /^https:\/\/checkout\.paystack\.com\//i.test(authorizationUrl)) {
          clearCart();
          window.location.assign(authorizationUrl);
          return finalOrder;
        }
        const initializationMessage = payRes?.error || payRes?.message || payRes?.data?.error || 'Paystack could not start the card payment. Please try again.';
        paystackInitializationError = initializationMessage;
        throw new Error(initializationMessage);
      }
    } catch (error) {
      // Never swallow order-creation or payment errors for online card checkout.
      // Returning newOrder here makes CartDrawer think checkout succeeded and reset to cart.
      if (paystackInitializationError) {
        throw new Error(paystackInitializationError);
      }
      if (details.paymentMethod === 'Debit Card' && finalPayable > 0) {
        throw error instanceof Error ? error : new Error('Could not complete Paystack checkout. Please try again.');
      }
      setOrders((prev) => [newOrder, ...prev]);
      setActiveTrackingOrderId(newOrder.id);
      const orderTx: WalletDepositRecord = {
        id: `tx-ord-${newOrder.id}`,
        type: 'order',
        title: `Order Payment — ${cartRestaurant.name}`,
        description: cart.map((i) => `${i.quantity}x ${i.menuItem.name}`).join(', ') || 'Food items',
        reference: newOrder.shortId || newOrder.id,
        amount: -Math.abs(grossTotal),
        timestamp: formatOrderTime(new Date()),
        status: 'completed',
        paymentMethod: details.paymentMethod
      };
      setWalletDeposits((prev) => [orderTx, ...prev.filter((p) => p.id !== orderTx.id && p.reference !== orderTx.reference)]);
      return newOrder;
    }

    // Automatically ensure this address is saved in D1 for the authenticated user
    if (user && details.customerAddress && details.customerAddress.trim()) {
      addSavedAddress({
        label: 'Home',
        address: details.customerAddress.trim(),
        apartment: details.customerApartment || '',
        city: 'Lagos',
        isDefault: true
      }).catch(() => {});
    }

    if (walletDeduction > 0) {
      setWalletBalanceNGN((prev) => Math.max(0, prev - walletDeduction));
    }

    setCart([]);
    setAppliedPromo(null);
    setIsCartOpenState(false);
    setIsTrackingModalOpen(true);

    return finalOrder;
  };

  const advanceOrderStatus = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    const progressMap: Record<OrderStatus, number> = {
      awaiting_payment: 0,
      placed: 5,
      confirmed: 15,
      preparing: 30,
      ready_for_pickup: 55,
      in_transit: 80,
      delivered: 100,
      cancelled: 0
    };
    const etaMap: Record<OrderStatus, number> = {
      awaiting_payment: 0,
      placed: 35,
      confirmed: 30,
      preparing: 22,
      ready_for_pickup: 15,
      in_transit: 8,
      delivered: 0,
      cancelled: 0
    };

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const nowStr = formatOrderTime(new Date());
          const descMap: Record<OrderStatus, string> = {
            awaiting_payment: 'Awaiting payment confirmation',
            placed: 'Order placed by customer',
            confirmed: 'Restaurant accepted ticket',
            preparing: 'Kitchen started cooking meal',
            ready_for_pickup: 'Packaged & waiting for dispatch rider',
            in_transit: 'Rider picked up meal & is en route',
            delivered: 'Handover PIN verified & delivered to doorstep',
            cancelled: 'Order was cancelled'
          };
          const nextHistory = [
            ...(ord.statusHistory || []),
            { status: newStatus, timestamp: nowStr, note: note || descMap[newStatus] }
          ];

          return {
            ...ord,
            status: newStatus,
            routeProgress: progressMap[newStatus] ?? ord.routeProgress,
            estimatedArrivalMinutes: etaMap[newStatus] ?? ord.estimatedArrivalMinutes,
            statusHistory: nextHistory
          };
        }
        return ord;
      })
    );

    await api.orders.updateStatus(orderId, newStatus, note, {
      routeProgress: progressMap[newStatus],
      estimatedArrivalMinutes: etaMap[newStatus]
    } as any).catch(() => {});
    await refreshData().catch(() => {});
  };

  const verifyOrderHandover = async (orderId: string, enteredPin: string): Promise<boolean> => {
    try {
      const response = await api.orders.verifyHandover(orderId, enteredPin);
      if (response && response.success) {
        // Optimistically update locally too
        setOrders((prev) =>
          prev.map((ord) => {
            if (ord.id === orderId) {
              const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return {
                ...ord,
                status: 'delivered',
                statusHistory: [
                  ...(ord.statusHistory || []),
                  { status: 'delivered', timestamp: nowStr, note: 'Handover PIN verified & delivered to doorstep' }
                ]
              };
            }
            return ord;
          })
        );
        return true;
      }
      return false;
    } catch (error) {
      // Never confirm a handover from client-side state when the server is unavailable.
      // The backend is authoritative for order ownership, status, and one-time confirmation.
      console.error('Server-side handover verification failed; refusing client-side fallback.', error);
      return false;
    }
  };

  const adjustOrderPrepTime = async (orderId: string, minutes: number) => {
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              estimatedArrivalMinutes: Math.max(5, (ord.estimatedArrivalMinutes || 30) + minutes)
            }
          : ord
      )
    );
    api.orders.adjustPrepTime(orderId, minutes).catch(() => {});
  };

  const refundOrder = async (orderId: string, amount: number, reason: string) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'cancelled' as OrderStatus } : ord))
    );
    setWalletBalanceNGN((prev) => prev + amount);
    api.orders.refund(orderId, amount, reason).catch(() => {});
  };

  const updateItemAvailability = async (restaurantId: string, itemId: string, isAvailable: boolean) => {
    setRestaurants((prev) =>
      prev.map((r) => {
        if (r.id === restaurantId) {
          return {
            ...r,
            categories: r.categories.map((c) => ({
              ...c,
              items: c.items.map((it) => (it.id === itemId ? { ...it, isAvailable } : it))
            }))
          };
        }
        return r;
      })
    );
    api.restaurants.updateAvailability(restaurantId, itemId, isAvailable).catch(() => {});
  };

  const setBusyMode = async (restaurantId: string, isBusy: boolean) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurantId ? { ...r, isBusyPaused: isBusy } : r))
    );
    api.restaurants.setBusyMode(restaurantId, isBusy).catch(() => {});
  };

  const sendChatMessage = async (orderId: string, text: string, sender: 'customer' | 'courier' = 'customer') => {
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            messages: [...(o.messages || []), newMsg]
          };
        }
        return o;
      })
    );
  };

  // Auth-guarded order tracking
  const openTracking = (orderId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTrackingOrderId(orderId);
    setIsTrackingModalOpen(true);
  };

  const closeTracking = () => {
    setIsTrackingModalOpen(false);
  };

  return (
    <DeliveryContext.Provider
      value={{
        getCmsText,
        cmsContent,
        activeRole,
        setActiveRole,
        activePage,
        setActivePage,
        isRightDrawerOpen,
        setIsRightDrawerOpen,
        platformSettings,
        deliveryZones,
        serviceFee,
        adminActiveTab,
        setAdminActiveTab,
        currency,
        setCurrency,
        selectedZone,
        setSelectedZone,
        savedAddresses,
        selectedAddress,
        setSelectedAddress,
        addSavedAddress,
        deleteSavedAddress,
        restaurants,
        selectedRestaurantId,
        setSelectedRestaurantId,
        selectedRestaurantForPortal,
        setSelectedRestaurantForPortal,
        customizingItem,
        openCustomizer,
        closeCustomizer,
        cart,
        cartRestaurant,
        isCartOpen,
        setIsCartOpen,
        fulfillmentType,
        setFulfillmentType,
        scheduledSlot,
        setScheduledSlot,
        isContactless,
        setIsContactless,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        useWalletCredit,
        setUseWalletCredit,
        walletBalanceNGN,
        walletDeposits,
        topUpWallet,
        isWalletModalOpen,
        setIsWalletModalOpen,
        favourites,
        toggleFavourite,
        isFavourite,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        reorderPastOrder,
        cartConflict,
        cancelCartConflict,
        confirmCartConflict,
        orders,
        activeTrackingOrderId,
        activeTrackingOrder,
        isTrackingModalOpen,
        openTracking,
        closeTracking,
        placeOrder,
        advanceOrderStatus,
        verifyOrderHandover,
        adjustOrderPrepTime,
        refundOrder,
        updateItemAvailability,
        setBusyMode,
        sendChatMessage,
        refreshData
      }}
    >
      {children}
    </DeliveryContext.Provider>
  );
};

export const useDelivery = () => {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error('useDelivery must be used within a DeliveryProvider');
  }
  return context;
};
