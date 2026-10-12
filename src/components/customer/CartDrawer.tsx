import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  MapPin,
  Calendar,
  Package,
  Tag,
  Wallet,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Building,
  Lock,
  ArrowRight
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const { user, setIsAuthModalOpen } = useAuth();
  const {
    cart,
    cartRestaurant,
    isCartOpen,
    setIsCartOpen,
    currency,
    serviceFee,
    fulfillmentType,
    setFulfillmentType,
    scheduledSlot,
    setScheduledSlot,
    isContactless,
    setIsContactless,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    walletBalanceNGN,
    useWalletCredit,
    setUseWalletCredit,
    savedAddresses,
    selectedAddress,
    setSelectedAddress,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    placeOrder
  } = useDelivery();

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customAddress, setCustomAddress] = useState(selectedAddress?.address || user?.address || '');
  const [customerApartment, setCustomerApartment] = useState(selectedAddress?.apartment || '');
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [liveDistanceResult, setLiveDistanceResult] = useState<{
    distanceKm: number;
    distanceText: string;
    durationText: string;
    durationMinutes: number;
    estimatedDeliveryFee: number;
    inDeliveryRadius?: boolean;
    userLocation?: { lat: number; lng: number; formattedAddress?: string };
    restaurantLocation?: { lat: number; lng: number; formattedAddress?: string };
    isCalculating?: boolean;
  } | null>(null);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const distanceRequestId = useRef(0);

  // Wallet is the primary payment source whenever a balance is available.
  // The card is used only for any amount the wallet cannot cover.
  useEffect(() => {
    setUseWalletCredit(Number(walletBalanceNGN) > 0);
  }, [walletBalanceNGN, setUseWalletCredit]);

  useEffect(() => {
    if (selectedAddress?.address && selectedAddress.address.trim()) {
      setCustomAddress(selectedAddress.address.trim());
      setCustomerApartment(selectedAddress.apartment || '');
    } else if (user?.address && user.address.trim()) {
      setCustomAddress(user.address.trim());
    } else {
      setCustomAddress('');
      setCustomerApartment('');
    }
    if (user?.name) setCustomerName(user.name);
    if (user?.phone) setCustomerPhone(user.phone);
  }, [user, selectedAddress]);

  // Depend on the stable restaurant ID, not the context's restaurant object identity.
  // Some context providers recreate that object during renders; depending on the object
  // can retrigger this callback/effect and leave the UI repeatedly showing "Calculating".
  const restaurantId = cartRestaurant?.id;
  const calculateDistanceNow = useCallback(
    async (addressStr: string, coords?: { lat: number; lng: number }) => {
      const requestId = ++distanceRequestId.current;
      const address = addressStr.trim();
      if (!restaurantId || !address) {
        setLiveDistanceResult(null);
        setDistanceError(null);
        return;
      }

      setLiveDistanceResult({
        distanceKm: 0,
        distanceText: '',
        durationText: '',
        durationMinutes: 0,
        estimatedDeliveryFee: 0,
        isCalculating: true
      });
      setDistanceError(null);

      try {
        const hasCoords = coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng) &&
          coords.lat >= -90 && coords.lat <= 90 && coords.lng >= -180 && coords.lng <= 180;
        const res = await api.restaurants.calculateDistance({
          restaurantId,
          userAddress: address,
          ...(hasCoords ? { userLat: coords!.lat, userLng: coords!.lng } : {})
        });
        if (requestId !== distanceRequestId.current) return;
        if (!res || !Number.isFinite(Number(res.distanceKm)) ||
            !Number.isFinite(Number(res.durationMinutes)) || Number(res.durationMinutes) <= 0 ||
            !Number.isFinite(Number(res.estimatedDeliveryFee)) ||
            typeof res.inDeliveryRadius !== 'boolean' ||
            !res.distanceText || !res.durationText) {
          throw new Error('The routing service did not return a valid distance quote. Please retry.');
        }
        setLiveDistanceResult({
          distanceKm: Number(res.distanceKm),
          distanceText: String(res.distanceText),
          durationText: String(res.durationText),
          durationMinutes: Number(res.durationMinutes),
          estimatedDeliveryFee: Number(res.estimatedDeliveryFee),
          inDeliveryRadius: res.inDeliveryRadius,
          userLocation: res.userLocation,
          restaurantLocation: res.restaurantLocation,
          isCalculating: false
        });
        if (res.userLocation?.lat && res.userLocation?.lng) {
          setCustomCoords({ lat: res.userLocation.lat, lng: res.userLocation.lng });
        }
      } catch (err) {
        if (requestId !== distanceRequestId.current) return;
        setLiveDistanceResult(null);
        setDistanceError(err instanceof Error ? err.message : 'Live distance could not be calculated. Please retry.');
      }
    },
    [restaurantId]
  );

  useEffect(() => {
    if (!cartRestaurant) return;
    const targetAddr = customAddress.trim() || selectedAddress?.address?.trim() || user?.address?.trim() || '';
    if (!targetAddr) { setLiveDistanceResult(null); return; }
    const timer = setTimeout(() => {
      calculateDistanceNow(targetAddr, customCoords || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [restaurantId, customAddress, user?.address, selectedAddress?.address, customCoords, calculateDistanceNow]);

  const [selectedTipNGN, setSelectedTipNGN] = useState<number>(0);
  const hasWalletBalance = (Number(walletBalanceNGN) || 0) > 0;
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'balance' | 'card'>(
    (Number(walletBalanceNGN) || 0) > 0 ? 'balance' : 'card'
  );

  // Auto-select balance first if funds exist, otherwise select card
  useEffect(() => {
    if ((Number(walletBalanceNGN) || 0) > 0) {
      setSelectedPaymentMode('balance');
    } else {
      setSelectedPaymentMode('card');
    }
  }, [walletBalanceNGN]);

  const [promoInput, setPromoInput] = useState<string>('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [promoPlaceholder, setPromoPlaceholder] = useState<string>('Enter a promo code');

  useEffect(() => {
    api.settings.getPromos().then((res: any) => {
      const list = res?.data || res || [];
      if (Array.isArray(list) && list.length > 0) {
        const codes = list.slice(0, 2).map((p: any) => p.code).join(' or ');
        setPromoPlaceholder(`Try ${codes}`);
      } else {
        setPromoPlaceholder('Enter promo code');
      }
    }).catch(() => {
      setPromoPlaceholder('Enter promo code');
    });
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'checkout'>('cart');

  if (!isCartOpen) return null;

  // No lock screen - guests can view and build carts freely!
  const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const deliveryFee =
    fulfillmentType === 'pickup'
      ? 0
      : liveDistanceResult && !liveDistanceResult.isCalculating ? liveDistanceResult.estimatedDeliveryFee : 0;
  // serviceFee resolved dynamically from Platform D1 settings
  const discount = appliedPromo ? appliedPromo.discountAmount : 0;
  const tip = fulfillmentType === 'pickup' ? 0 : selectedTipNGN;

  const deliveryFeeLabel = fulfillmentType === 'pickup'
    ? formatCurrency(0, currency)
    : liveDistanceResult && !liveDistanceResult.isCalculating
      ? formatCurrency(deliveryFee, currency)
      : liveDistanceResult?.isCalculating ? 'Calculating…' : 'Enter address';

  const preWalletTotal = Math.max(0, subtotal + deliveryFee + serviceFee + tip - discount);

  const walletDeduction = Math.min(Math.max(0, Number(walletBalanceNGN) || 0), preWalletTotal);

  const finalCardCharge = Math.max(0, preWalletTotal - walletDeduction);

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoInput.trim()) return;
    const res = await applyPromoCode(promoInput.trim());
    setPromoMessage({ text: res.message, isError: !res.success });
    if (res.success) {
      setPromoInput('');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !cartRestaurant) return;
    const resolvedCustomerAddress = customAddress.trim() || selectedAddress?.address?.trim() || user?.address?.trim() || '';
    if (fulfillmentType !== 'pickup' && !resolvedCustomerAddress) {
      setPromoMessage({ text: 'Enter or select your real delivery address before placing the order.', isError: true });
      return;
    }
    if (fulfillmentType !== 'pickup' && liveDistanceResult && !liveDistanceResult.inDeliveryRadius) {
      setPromoMessage({ text: 'This address is outside the configured delivery radius for this restaurant.', isError: true });
      return;
    }
    if (fulfillmentType !== 'pickup' && (!liveDistanceResult || liveDistanceResult.isCalculating || distanceError)) {
      setPromoMessage({ text: 'A fresh live road-distance quote is required before delivery checkout. Verify your address and retry the distance calculation.', isError: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const effectivePaymentMethod =
        selectedPaymentMode === 'balance' && walletDeduction >= preWalletTotal
          ? 'Veyrang Wallet'
          : selectedPaymentMode === 'balance' && walletDeduction > 0
          ? 'Veyrang Wallet + Debit Card'
          : 'Debit Card';

      await placeOrder({
        customerName: customerName || user?.name || 'Customer',
        customerPhone: customerPhone || user?.phone || '+234 800 000 0000',
        customerAddress: resolvedCustomerAddress,
        customerApartment,
        customerLat: customCoords?.lat ?? liveDistanceResult?.userLocation?.lat,
        customerLng: customCoords?.lng ?? liveDistanceResult?.userLocation?.lng,
        deliveryNotes,
        tip,
        deliveryFee: fulfillmentType === 'pickup' ? 0 : liveDistanceResult?.estimatedDeliveryFee,
        drivingMinutes: fulfillmentType === 'pickup' ? 0 : liveDistanceResult?.durationMinutes,
        paymentMethod: effectivePaymentMethod
      });
      setCheckoutStep('cart');
    } catch (err: any) {
      setPromoMessage({ text: err.message || 'Payment processing failed. Please try again.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Dimmed Backdrop */}
      <div
        onClick={() => {
          setIsCartOpen(false);
          setCheckoutStep('cart');
        }}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* Cart & Checkout Panel */}
      <div className="relative w-full max-w-md h-full bg-white text-slate-900 shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              {checkoutStep === 'cart' ? 'Your Food Cart' : 'Checkout & Pay'}
            </h2>
            {cart.length > 0 && checkoutStep === 'cart' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                {cart.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {checkoutStep === 'checkout' && (
              <button
                onClick={() => setCheckoutStep('cart')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Back to Cart
              </button>
            )}
            <button
              onClick={() => {
                setIsCartOpen(false);
                setCheckoutStep('cart');
              }}
              aria-label="Close cart"
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Empty State */}
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Your cart is empty</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Explore top-rated restaurants near you and add your favorite meals to start ordering.
            </p>
            <button
              onClick={() => setIsCartOpen(false)}
              className="mt-6 px-6 py-2.5 rounded-2xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors shadow-xs cursor-pointer"
            >
              Browse Restaurants
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
            {/* Restaurant Indicator */}
            {cartRestaurant && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ordering From</div>
                  <div className="text-sm font-bold text-slate-900">{cartRestaurant.name}</div>
                  <div className="text-[11px] text-slate-500">{cartRestaurant.address}</div>
                </div>
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 p-1 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            {/* STEP 1: CART VIEW */}
            {checkoutStep === 'cart' && (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <div
                      key={item.cartItemId}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-900">{item?.menuItem?.name || (item as any)?.name || 'Dish'}</h4>
                          <span className="text-xs font-bold text-orange-600 font-mono tabular-nums">
                            {formatCurrency(item?.menuItem?.price || item?.itemTotal || 0, currency)}
                          </span>

                          {item.selectedOptions.length > 0 && (
                            <div className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                              {item.selectedOptions.map((opt) => (
                                <div key={opt.optionId}>
                                  + {opt.optionName}{' '}
                                  {opt.price > 0 && `(+${formatCurrency(opt.price, currency)})`}
                                </div>
                              ))}
                            </div>
                          )}

                          {item.specialInstructions && (
                            <p className="text-[11px] text-slate-400 italic mt-1">
                              Note: {item.specialInstructions}
                            </p>
                          )}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 shrink-0">
                          <button
                            onClick={() => updateCartQuantity(item.cartItemId, -1)}
                            className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:text-red-600 flex items-center justify-center shadow-xs cursor-pointer"
                          >
                            {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-xs font-bold text-slate-900 w-4 text-center font-mono">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.cartItemId, 1)}
                            className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:text-orange-600 flex items-center justify-center shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-400 text-[11px]">Item total</span>
                        <span className="font-bold text-slate-900 font-mono tabular-nums">
                          {formatCurrency(item.itemTotal, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code Input */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-orange-600" />
                      <span>Promo Code</span>
                    </span>
                    {appliedPromo && (
                      <button
                        onClick={removePromoCode}
                        className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {appliedPromo ? (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold">{appliedPromo.code}</span>
                        <span className="text-[11px] text-emerald-600 ml-2">({appliedPromo.description})</span>
                      </div>
                      <span className="font-mono font-bold">-{formatCurrency(appliedPromo.discountAmount, currency)}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyPromo} className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder={promoPlaceholder}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:border-orange-500"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </form>
                  )}

                  {promoMessage && (
                    <div className={`text-[11px] font-medium ${promoMessage.isError ? 'text-red-600' : 'text-emerald-700'}`}>
                      {promoMessage.text}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: CHECKOUT VIEW */}
            {checkoutStep === 'checkout' && (
              <div className="space-y-4">
                {/* Fulfillment Tabs */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => setFulfillmentType('delivery')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      fulfillmentType === 'delivery'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Doorstep Delivery
                  </button>
                  <button
                    onClick={() => setFulfillmentType('pickup')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      fulfillmentType === 'pickup'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Self-Pickup (₦0 Fee)
                  </button>
                </div>

                {/* Delivery Address & Customer Details */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      <span>Delivery Details</span>
                    </span>

                    {savedAddresses.length > 0 && (
                      <select
                        value={selectedAddress?.id}
                        onChange={(e) => {
                          const found = savedAddresses.find((a) => a.id === e.target.value);
                          if (found) {
                            setSelectedAddress(found);
                            setCustomAddress(found.address);
                            setCustomerApartment(found.apartment || '');
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] text-slate-700 font-medium cursor-pointer"
                      >
                        {savedAddresses.map((addr) => (
                          <option key={addr.id} value={addr.id}>
                            {addr.label}: {(addr.address || '').split(',')[0]}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Recipient Full Name"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone (+234...)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 font-mono"
                    />
                    <AddressAutocompleteInput
                      value={customAddress}
                      onChange={(nextAddress) => {
                        setCustomAddress(nextAddress);
                        // Coordinates belong to a verified selection only. Do not route a newly typed
                        // address using coordinates from the previous address.
                        if (nextAddress.trim() !== customAddress.trim()) setCustomCoords(null);
                      }}
                      onAddressSelect={(data) => {
                        setCustomAddress(data.address);
                        if (data.apartment && !customerApartment) {
                          setCustomerApartment(data.apartment);
                        }
                        if (data.latitude && data.longitude) {
                          setCustomCoords({ lat: data.latitude, lng: data.longitude });
                        }
                        if (data.address) {
                          calculateDistanceNow(
                            data.address,
                            data.latitude && data.longitude
                              ? { lat: data.latitude, lng: data.longitude }
                              : undefined
                          );
                        }
                      }}
                      placeholder="Delivery street address or landmark (live verified)"
                      required
                    />
                    <input
                      type="text"
                      value={customerApartment}
                      onChange={(e) => setCustomerApartment(e.target.value)}
                      placeholder="Apartment, Gate No, or Buzzer"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="Instructions for rider (e.g. Call at gate)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                    />

                    {cartRestaurant && (
                      <div className="flex items-center justify-between text-[11px] bg-orange-50 border border-orange-200/80 px-2.5 py-1.5 rounded-xl text-orange-950 font-medium animate-in fade-in">
                        <span className="flex items-center gap-1 text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>Live Road Distance:</span>
                        </span>
                        <span className="font-bold font-mono text-orange-700">
                          {liveDistanceResult?.isCalculating ? (
                            <span className="text-orange-500 font-normal italic">Calculating live road distance…</span>
                          ) : liveDistanceResult ? (
                            `${liveDistanceResult.distanceText} · ${liveDistanceResult.durationText}`
                          ) : (
                            <span className="text-red-600 font-medium">Live distance not verified</span>
                          )}
                        </span>
                      </div>
                    )}
                    {promoMessage?.isError && checkoutStep === 'checkout' && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700" role="alert">
                        {promoMessage.text}
                      </div>
                    )}
                    {distanceError && fulfillmentType !== 'pickup' && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700" role="alert">
                        <p>{distanceError}</p>
                        <button
                          type="button"
                          onClick={() => calculateDistanceNow(customAddress || selectedAddress?.address || user?.address || '')}
                          className="mt-2 font-bold underline underline-offset-2"
                        >
                          Retry live distance
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Balance-first payment selection: Balance first, and if no money in balance select card */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-orange-600" />
                      <span>Payment Method</span>
                    </span>
                    {hasWalletBalance && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Balance First
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Option 1: Veyrang Wallet Balance (Selected first whenever there is a balance) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (hasWalletBalance) setSelectedPaymentMode('balance');
                      }}
                      disabled={!hasWalletBalance}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors cursor-pointer text-left ${
                        selectedPaymentMode === 'balance' && hasWalletBalance
                          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                          : hasWalletBalance
                          ? 'border-slate-200 hover:border-slate-300 bg-white'
                          : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-4 h-4 rounded-full border-[5px] shrink-0 transition-colors ${
                            selectedPaymentMode === 'balance' && hasWalletBalance
                              ? 'border-emerald-600 bg-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-bold text-slate-900">Veyrang Wallet Balance</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Available: {formatCurrency(walletBalanceNGN, currency)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {hasWalletBalance ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {walletDeduction >= preWalletTotal
                              ? 'Covers 100%'
                              : `Covers ${formatCurrency(walletDeduction, currency)}`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                            Empty
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Option 2: Debit Card (Selected when balance is empty or for remaining charge) */}
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMode('card')}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors cursor-pointer text-left ${
                        selectedPaymentMode === 'card' || (!hasWalletBalance)
                          ? 'border-orange-500 bg-orange-50/60 ring-1 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-4 h-4 rounded-full border-[5px] shrink-0 transition-colors ${
                            selectedPaymentMode === 'card' || (!hasWalletBalance)
                              ? 'border-orange-600 bg-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-orange-600" />
                            <span className="font-bold text-slate-900">Debit Card (Paystack)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {!hasWalletBalance
                              ? 'Selected automatically because wallet balance is empty'
                              : finalCardCharge > 0
                              ? `Covers remaining ${formatCurrency(finalCardCharge, currency)}`
                              : 'Instant card payment'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {!hasWalletBalance ? 'Selected' : selectedPaymentMode === 'card' ? 'Selected' : 'Card'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {hasWalletBalance && selectedPaymentMode === 'balance' ? (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 font-medium">
                      {walletDeduction >= preWalletTotal
                        ? '✓ Wallet balance covers the full order. No card payment required.'
                        : `✓ Wallet pays ${formatCurrency(walletDeduction, currency)} first; remaining ${formatCurrency(finalCardCharge, currency)} charged to Debit Card.`}
                    </div>
                  ) : !hasWalletBalance ? (
                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      Your wallet has no available balance. Debit Card is selected to complete the order.
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* FINANCIAL BREAKDOWN (Section D/E of user prompt) */}
            <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(subtotal, currency)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery</span>
                <span className="font-mono tabular-nums">{deliveryFeeLabel}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Service</span>
                <span className="font-mono tabular-nums">{formatCurrency(serviceFee, currency)}</span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 font-semibold">
                  <span>Discount ({appliedPromo?.code})</span>
                  <span className="font-mono tabular-nums">−{formatCurrency(discount, currency)}</span>
                </div>
              )}

              {walletDeduction > 0 && (
                <div className="flex items-center justify-between text-orange-700 font-semibold">
                  <span>Wallet Deduction</span>
                  <span className="font-mono tabular-nums">−{formatCurrency(walletDeduction, currency)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm font-extrabold text-slate-900">
                <span>TOTAL</span>
                <span className="font-mono tabular-nums text-orange-600 text-base">
                  {formatCurrency(finalCardCharge > 0 ? finalCardCharge : preWalletTotal, currency)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Action Footer */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white space-y-2">
            {checkoutStep === 'cart' ? (
              <>
                <button
                  onClick={() => {
                    if (!user) {
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setCheckoutStep('checkout');
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition-colors shadow-md shadow-orange-600/20 cursor-pointer flex items-center justify-between"
                >
                  <span>{user ? 'Go to checkout' : 'Sign in to checkout'}</span>
                  <span className="font-mono tabular-nums">{formatCurrency(preWalletTotal, currency)}</span>
                </button>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200/90 text-slate-900 font-bold text-sm transition-all border border-slate-200/80 cursor-pointer flex items-center justify-between active:scale-[0.99]"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4.5 h-4.5 text-orange-600 shrink-0" />
                    <span>Add More Items</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-500 truncate max-w-[140px]">
                    {cartRestaurant?.name || 'Menu'}
                  </span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (!user) {
                    setIsAuthModalOpen(true);
                    return;
                  }
                  handleCheckout();
                }}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition-colors shadow-md shadow-orange-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Processing Order...</span>
                ) : (
                  <>
                    <span>Place Order ·</span>
                    <span className="font-mono tabular-nums">
                      {selectedPaymentMode === 'balance' && walletDeduction >= preWalletTotal
                        ? `${formatCurrency(preWalletTotal, currency)} (Balance)`
                        : selectedPaymentMode === 'balance' && walletDeduction > 0
                        ? `${formatCurrency(finalCardCharge, currency)} Card (${formatCurrency(walletDeduction, currency)} Balance)`
                        : formatCurrency(preWalletTotal, currency)}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
