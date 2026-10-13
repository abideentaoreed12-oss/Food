'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDelivery } from '../../context/DeliveryContext';
import { formatCurrency } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ROUTES } from '../../routes';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import {
  ShoppingBag,
  MapPin,
  Tag,
  Wallet,
  ShieldCheck,
  ChevronRight,
  Clock,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Utensils,
  ArrowRight,
  User,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowLeft
} from 'lucide-react';

export const CartPage: React.FC = () => {
  const router = useRouter();
  const { user, setIsAuthModalOpen } = useAuth();
  const {
    cart,
    cartRestaurant,
    currency,
    serviceFee,
    fulfillmentType,
    setFulfillmentType,
    scheduledSlot,
    isContactless,
    appliedPromo,
    applyPromoCode,
    removePromoCode,
    walletBalanceNGN,
    setUseWalletCredit,
    savedAddresses,
    selectedAddress,
    setSelectedAddress,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
    promos
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

  // Tips state
  const [selectedTipNGN, setSelectedTipNGN] = useState<number>(0);
  const hasWalletBalance = (Number(walletBalanceNGN) || 0) > 0;
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'balance' | 'card'>(
    (Number(walletBalanceNGN) || 0) > 0 ? 'balance' : 'card'
  );

  // Promo state
  const [promoInput, setPromoInput] = useState<string>('');
  const [promoMessage, setPromoMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [promoPlaceholder, setPromoPlaceholder] = useState<string>('Enter promo code');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select balance first if funds exist
  useEffect(() => {
    setUseWalletCredit(Number(walletBalanceNGN) > 0);
    if ((Number(walletBalanceNGN) || 0) > 0) {
      setSelectedPaymentMode('balance');
    } else {
      setSelectedPaymentMode('card');
    }
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

  // Load promos for suggestions
  useEffect(() => {
    if (Array.isArray(promos) && promos.length > 0) {
      const codes = promos.slice(0, 2).map((p: any) => p.code).join(' or ');
      setPromoPlaceholder(`Try ${codes}`);
      return;
    }
    api.settings
      .getPromos()
      .then((res: any) => {
        const list = res?.data || res || [];
        if (Array.isArray(list) && list.length > 0) {
          const codes = list.slice(0, 2).map((p: any) => p.code).join(' or ');
          setPromoPlaceholder(`Try ${codes}`);
        } else {
          setPromoPlaceholder('Enter promo code');
        }
      })
      .catch(() => {
        setPromoPlaceholder('Enter promo code');
      });
  }, [promos]);

  // Stable restaurant ID calculation
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
        const hasCoords =
          coords &&
          Number.isFinite(coords.lat) &&
          Number.isFinite(coords.lng) &&
          coords.lat >= -90 &&
          coords.lat <= 90 &&
          coords.lng >= -180 &&
          coords.lng <= 180;
        const res = await api.restaurants.calculateDistance({
          restaurantId,
          userAddress: address,
          ...(hasCoords ? { userLat: coords!.lat, userLng: coords!.lng } : {})
        });
        if (requestId !== distanceRequestId.current) return;
        if (
          !res ||
          !Number.isFinite(Number(res.distanceKm)) ||
          !Number.isFinite(Number(res.durationMinutes)) ||
          Number(res.durationMinutes) <= 0 ||
          !Number.isFinite(Number(res.estimatedDeliveryFee)) ||
          typeof res.inDeliveryRadius !== 'boolean' ||
          !res.distanceText ||
          !res.durationText
        ) {
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
    if (!targetAddr) {
      setLiveDistanceResult(null);
      return;
    }
    const timer = setTimeout(() => {
      calculateDistanceNow(targetAddr, customCoords || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [restaurantId, customAddress, user?.address, selectedAddress?.address, customCoords, calculateDistanceNow, cartRestaurant]);

  // Financial calculations
  const subtotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
  const deliveryFee =
    fulfillmentType === 'pickup'
      ? 0
      : liveDistanceResult && !liveDistanceResult.isCalculating
      ? liveDistanceResult.estimatedDeliveryFee
      : 0;
  const discount = appliedPromo ? appliedPromo.discountAmount : 0;
  const tip = fulfillmentType === 'pickup' ? 0 : selectedTipNGN;

  const deliveryFeeLabel =
    fulfillmentType === 'pickup'
      ? formatCurrency(0, currency)
      : liveDistanceResult && !liveDistanceResult.isCalculating
      ? formatCurrency(deliveryFee, currency)
      : liveDistanceResult?.isCalculating
      ? 'Calculating…'
      : 'Enter address';

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
    const resolvedCustomerAddress =
      customAddress.trim() || selectedAddress?.address?.trim() || user?.address?.trim() || '';
    if (fulfillmentType !== 'pickup' && !resolvedCustomerAddress) {
      setPromoMessage({ text: 'Enter or select your real delivery address before placing the order.', isError: true });
      return;
    }
    if (fulfillmentType !== 'pickup' && liveDistanceResult && !liveDistanceResult.inDeliveryRadius) {
      setPromoMessage({ text: 'This address is outside the configured delivery radius for this restaurant.', isError: true });
      return;
    }
    if (fulfillmentType !== 'pickup' && (!liveDistanceResult || liveDistanceResult.isCalculating || distanceError)) {
      setPromoMessage({
        text: 'A fresh live road-distance quote is required before delivery checkout. Verify your address and retry the distance calculation.',
        isError: true
      });
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
      // Redirect to orders history to view live tracking and receipt
      router.push(ROUTES.ORDERS);
    } catch (err: any) {
      setPromoMessage({ text: err.message || 'Payment processing failed. Please try again.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // EMPTY CART STATE
  if (cart.length === 0) {
    return (
      <div className="max-w-xl sm:max-w-2xl mx-auto px-4 py-12 sm:py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-[#E8F5EF] border border-[#0D4F3C]/20 text-[#0D4F3C] flex items-center justify-center mx-auto shadow-sm">
          <ShoppingBag className="w-10 h-10 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
            Your Cart is Empty
          </h1>
          <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
            You don&apos;t have any delicious meals in your cart yet. Explore our curated partner restaurants and order authentic local dishes.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href={ROUTES.RESTAURANTS}
            prefetch={true}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#0D4F3C] hover:bg-[#0A3F30] text-white font-bold text-sm shadow-md shadow-[#0D4F3C]/20 transition-all cursor-pointer active:scale-95"
          >
            <Utensils className="w-4 h-4" />
            <span>Browse Restaurants & Order Now</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
              Shopping Cart & Checkout
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5EF] text-[#0D4F3C]">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review your selected dishes, verify live delivery destination, and complete payment
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cartRestaurant && (
            <Link
              href={ROUTES.RESTAURANT_DETAIL(cartRestaurant.id)}
              prefetch={true}
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#0D4F3C]" />
              <span>Add More Items</span>
            </Link>
          )}
          <button
            onClick={clearCart}
            className="text-xs font-semibold px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            Clear Cart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items List & Delivery Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Restaurant Banner */}
          {cartRestaurant && (
            <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ordering From</div>
                  <h2 className="text-base font-extrabold text-slate-900">{cartRestaurant.name}</h2>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{cartRestaurant.address}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cart Items List */}
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              <span>Selected Dishes</span>
            </h2>

            <div className="space-y-3">
              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900">
                        {item?.menuItem?.name || (item as any)?.name || 'Dish'}
                      </h4>
                      <span className="text-xs font-bold text-[#0D4F3C] font-mono tabular-nums">
                        {formatCurrency(item?.menuItem?.price || item?.itemTotal || 0, currency)}
                      </span>

                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                          {item.selectedOptions.map((opt) => (
                            <div key={opt.optionId}>
                              + {opt.optionName}{' '}
                              {opt.price > 0 && `(+${formatCurrency(opt.price, currency)})`}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <p className="text-xs text-slate-400 italic mt-1.5">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 shrink-0">
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, -1)}
                        className="w-7 h-7 rounded-xl bg-white text-slate-700 hover:text-red-600 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                        aria-label="Decrease quantity"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-5 text-center font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.cartItemId, 1)}
                        className="w-7 h-7 rounded-xl bg-white text-slate-700 hover:text-[#0D4F3C] flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-400 text-xs">Item total</span>
                    <span className="font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(item.itemTotal, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fulfillment Type & Delivery Details */}
          <div className="space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>Fulfillment & Delivery Details</span>
            </h2>

            {/* Fulfillment Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  fulfillmentType === 'delivery'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Doorstep Delivery
              </button>
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  fulfillmentType === 'pickup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Self-Pickup (₦0 Fee)
              </button>
            </div>

            {/* Delivery Inputs */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0D4F3C]" />
                  <span>Delivery Address</span>
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
                    className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-700 font-medium cursor-pointer"
                  >
                    {savedAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label}: {(addr.address || '').split(',')[0]}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Recipient Full Name"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C]"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (+234...)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C] font-mono"
                />
              </div>

              <AddressAutocompleteInput
                value={customAddress}
                onChange={(nextAddress) => {
                  setCustomAddress(nextAddress);
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={customerApartment}
                  onChange={(e) => setCustomerApartment(e.target.value)}
                  placeholder="Apartment, Gate No, or Buzzer"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C]"
                />
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Instructions for rider (e.g. Call at gate)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C]"
                />
              </div>

              {cartRestaurant && (
                <div className="flex items-center justify-between text-xs bg-[#E8F5EF] border border-emerald-200 px-3.5 py-2 rounded-xl text-slate-900 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <MapPin className="w-4 h-4 text-[#0D4F3C] shrink-0" />
                    <span>Live Road Distance:</span>
                  </span>
                  <span className="font-bold font-mono text-[#0D4F3C]">
                    {liveDistanceResult?.isCalculating ? (
                      <span className="text-[#147A5A] font-normal italic">Calculating live road distance…</span>
                    ) : liveDistanceResult ? (
                      `${liveDistanceResult.distanceText} · ${liveDistanceResult.durationText}`
                    ) : (
                      <span className="text-red-600 font-medium">Live distance not verified</span>
                    )}
                  </span>
                </div>
              )}

              {distanceError && fulfillmentType !== 'pickup' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p>{distanceError}</p>
                  <button
                    type="button"
                    onClick={() =>
                      calculateDistanceNow(customAddress || selectedAddress?.address || user?.address || '')
                    }
                    className="mt-1.5 font-bold underline underline-offset-2 cursor-pointer"
                  >
                    Retry live distance calculation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Promos, Payment, Breakdown & Place Order CTA */}
        <div className="lg:col-span-5 space-y-6">
          {/* Promo Code Card */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#0D4F3C]" />
                <span>Promo Code</span>
              </span>
              {appliedPromo && (
                <button
                  onClick={removePromoCode}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            {appliedPromo ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold">{appliedPromo.code}</span>
                  <span className="text-xs text-emerald-600 ml-2">({appliedPromo.description})</span>
                </div>
                <span className="font-mono font-bold">
                  -{formatCurrency(appliedPromo.discountAmount, currency)}
                </span>
              </div>
            ) : (
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder={promoPlaceholder}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:border-[#0D4F3C]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}

            {promoMessage && (
              <div
                className={`text-xs font-medium ${
                  promoMessage.isError ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {promoMessage.text}
              </div>
            )}
          </div>

          {/* Balance-First Payment Selection */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#0D4F3C]" />
                <span>Payment Method</span>
              </span>
              {hasWalletBalance && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Balance First
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Veyrang Wallet Balance */}
              <button
                type="button"
                onClick={() => {
                  if (hasWalletBalance) setSelectedPaymentMode('balance');
                }}
                disabled={!hasWalletBalance}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs transition-colors cursor-pointer text-left ${
                  selectedPaymentMode === 'balance' && hasWalletBalance
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/20'
                    : hasWalletBalance
                    ? 'border-slate-200 hover:border-slate-300 bg-white'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded-full border-[5px] shrink-0 transition-colors ${
                      selectedPaymentMode === 'balance' && hasWalletBalance
                        ? 'border-emerald-600 bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-900">Veyrang Wallet Balance</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Available: {formatCurrency(walletBalanceNGN, currency)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {hasWalletBalance ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {walletDeduction >= preWalletTotal
                        ? 'Covers 100%'
                        : `Covers ${formatCurrency(walletDeduction, currency)}`}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                      Empty
                    </span>
                  )}
                </div>
              </button>

              {/* Option 2: Debit / Credit Card */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMode('card')}
                className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs transition-colors cursor-pointer text-left ${
                  selectedPaymentMode === 'card' || !hasWalletBalance
                    ? 'border-[#0D4F3C] bg-[#E8F5EF]/60 ring-1 ring-[#0D4F3C]/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-4 h-4 rounded-full border-[5px] shrink-0 transition-colors ${
                      selectedPaymentMode === 'card' || !hasWalletBalance
                        ? 'border-[#0D4F3C] bg-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#0D4F3C]" />
                      <span className="font-bold text-slate-900">Debit / Credit Card</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {!hasWalletBalance
                        ? 'Selected automatically because wallet balance is empty'
                        : finalCardCharge > 0
                        ? `Covers remaining ${formatCurrency(finalCardCharge, currency)}`
                        : 'Instant card payment'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {!hasWalletBalance
                      ? 'Selected'
                      : selectedPaymentMode === 'card'
                      ? 'Selected'
                      : 'Card'}
                  </span>
                </div>
              </button>
            </div>

            {hasWalletBalance && selectedPaymentMode === 'balance' ? (
              <div className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-200 font-medium">
                {walletDeduction >= preWalletTotal
                  ? '✓ Wallet balance covers the full order. No card payment required.'
                  : `✓ Wallet pays ${formatCurrency(walletDeduction, currency)} first; remaining ${formatCurrency(
                      finalCardCharge,
                      currency
                    )} charged to Debit Card.`}
              </div>
            ) : !hasWalletBalance ? (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                Your wallet has no available balance. Debit Card is selected to complete the order.
              </div>
            ) : null}
          </div>

          {/* Itemized Financial Breakdown */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-mono tabular-nums">{formatCurrency(subtotal, currency)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Delivery Fee</span>
              <span className="font-mono tabular-nums">{deliveryFeeLabel}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Service & Technology</span>
              <span className="font-mono tabular-nums">{formatCurrency(serviceFee, currency)}</span>
            </div>

            {discount > 0 && (
              <div className="flex items-center justify-between text-emerald-600 font-semibold">
                <span>Discount ({appliedPromo?.code})</span>
                <span className="font-mono tabular-nums">−{formatCurrency(discount, currency)}</span>
              </div>
            )}

            {walletDeduction > 0 && (
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>Wallet Deduction</span>
                <span className="font-mono tabular-nums">−{formatCurrency(walletDeduction, currency)}</span>
              </div>
            )}

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-sm font-extrabold text-slate-900">
              <span>TOTAL</span>
              <span className="font-mono tabular-nums text-[#0D4F3C] text-lg font-black">
                {formatCurrency(finalCardCharge > 0 ? finalCardCharge : preWalletTotal, currency)}
              </span>
            </div>
          </div>

          {/* Place Order CTA */}
          <div className="space-y-3">
            {!user ? (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-[#0D4F3C] hover:bg-[#0A3F30] text-white font-bold text-sm transition-all shadow-md shadow-[#0D4F3C]/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                <span>Sign in to Complete Order</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full py-4 px-6 rounded-2xl bg-[#E8C547] hover:bg-[#D4B23A] text-[#0D4F3C] font-black text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
              >
                {isSubmitting ? (
                  <span>Processing Secure Checkout...</span>
                ) : (
                  <>
                    <span>Place Order ·</span>
                    <span className="font-mono tabular-nums">
                      {selectedPaymentMode === 'balance' && walletDeduction >= preWalletTotal
                        ? `${formatCurrency(preWalletTotal, currency)} (Balance)`
                        : selectedPaymentMode === 'balance' && walletDeduction > 0
                        ? `${formatCurrency(finalCardCharge, currency)} Card (${formatCurrency(
                            walletDeduction,
                            currency
                          )} Balance)`
                        : formatCurrency(preWalletTotal, currency)}
                    </span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>256-Bit SSL Encrypted Checkout · PIN Handover</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
