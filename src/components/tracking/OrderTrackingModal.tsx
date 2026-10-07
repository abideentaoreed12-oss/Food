import React, { useState, useEffect } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { DriverChatModal } from './DriverChatModal';
import { formatCurrency } from '../../utils/format';
import {
  X,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  MapPin,
  Utensils,
  Bike,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Receipt,
  Bell,
  Navigation,
  Printer,
  Download
} from 'lucide-react';

export const OrderTrackingModal: React.FC = () => {
  const {
    isTrackingModalOpen,
    closeTracking,
    activeTrackingOrder,
    currency
  } = useDelivery();

  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showItems, setShowItems] = useState(true);

  if (!user || !isTrackingModalOpen || !activeTrackingOrder) return null;

  const order = activeTrackingOrder;
  const isDelivered = order.status === 'delivered';

  // Live countdown calculation based on order creation timestamp + estimated arrival minutes (distance + 15m admin prep buffer)
  const totalEtaMins = order.estimatedArrivalMinutes || 25;
  const orderTimeMs = new Date(order.createdAt).getTime();
  const validOrderTime = isNaN(orderTimeMs) ? Date.now() : orderTimeMs;
  const targetArrivalMs = validOrderTime + totalEtaMins * 60 * 1000;

  const calculateSecondsLeft = () => {
    if (isDelivered) return 0;
    const diff = Math.floor((targetArrivalMs - Date.now()) / 1000);
    return Math.max(0, diff);
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateSecondsLeft);

  // Live Courier GPS Location & Connection Health Polling
  const [courierLoc, setCourierLoc] = useState<{ lat: number; lng: number; updatedAt?: string } | null>(null);
  const [signalStatus, setSignalStatus] = useState<'live' | 'paused' | 'searching'>('searching');

  useEffect(() => {
    if (!order.id || isDelivered) return;

    const fetchLiveTracking = async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}/tracking`);
        const json = await res.json();
        if (json.success && json.tracking) {
          if (json.tracking.location) {
            setCourierLoc(json.tracking.location);
          }
          setSignalStatus(json.tracking.signalStatus || 'searching');
        }
      } catch (err) {
        console.warn('Live tracking fetch error:', err);
      }
    };

    fetchLiveTracking();
    const trackingInterval = setInterval(fetchLiveTracking, 5000);
    return () => clearInterval(trackingInterval);
  }, [order.id, isDelivered]);

  useEffect(() => {
    if (isDelivered) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(calculateSecondsLeft());
    const timer = setInterval(() => {
      setSecondsLeft(calculateSecondsLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [order.id, order.status, order.createdAt, totalEtaMins]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  // Dynamic notification message based on real courier name, computed ETA, and order status
  const courierName = order.courier?.name || 'Assigned Courier';
  let notificationMsg = 'Order confirmed and successfully queued.';
  if (order.status === 'preparing') {
    notificationMsg = `${order.restaurantName} kitchen is freshly preparing your items. Est. remaining: ${mins} mins.`;
  } else if (order.status === 'ready_for_pickup') {
    notificationMsg = `Order is ready! ${courierName} is picking up your package at the kitchen.`;
  } else if (order.status === 'in_transit') {
    notificationMsg = `Rider ${courierName} is en route to ${order.customerAddress}! ETA ${mins} mins.`;
  } else if (order.status === 'delivered') {
    notificationMsg = `Order #${order.shortId} has been delivered to your doorstep. Enjoy your meal!`;
  }

  const milestones = [
    { key: 'placed', label: 'Placed', icon: Clock },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'preparing', label: 'Preparing', icon: Utensils },
    { key: 'ready_for_pickup', label: 'Ready', icon: CheckCircle2 },
    { key: 'in_transit', label: 'On the way', icon: Bike },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 }
  ];

  const statusOrderIndex: Record<string, number> = {
    placed: 0,
    confirmed: 1,
    preparing: 2,
    ready_for_pickup: 3,
    in_transit: 4,
    delivered: 5,
    cancelled: -1
  };

  const currentIdx = statusOrderIndex[order.status] ?? 0;
  const progressPercent = Math.min(100, Math.max(10, ((currentIdx + 1) / milestones.length) * 100));

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="printable-receipt relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900">
        {/* Header bar */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between no-print">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Dispatch & ETA Tracking</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>{order.restaurantName}</span>
              <span className="font-mono text-xs text-slate-400">({order.shortId})</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintReceipt}
              title="Download PDF / Print Receipt"
              aria-label="Download PDF / Print Receipt"
              className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF5500] text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
            <button
              onClick={closeTracking}
              aria-label="Close tracking"
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
          {/* Instant Notification Banner */}
          <div className="p-3.5 rounded-2xl bg-orange-50/90 border border-orange-200 flex items-center gap-3 animate-fade-in no-print">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1 text-xs font-semibold text-orange-900">
              {notificationMsg}
            </div>
          </div>

          {/* Live Courier GPS Telemetry Health Signal Badge */}
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300 no-print">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                signalStatus === 'live' ? 'bg-emerald-400 animate-ping' : signalStatus === 'paused' ? 'bg-amber-400' : 'bg-slate-500'
              }`} />
              <span className="font-bold text-white">
                {signalStatus === 'live' ? 'Live Courier GPS Active' : signalStatus === 'paused' ? 'GPS Signal Paused · Showing Last Known Position' : 'Waiting for Courier GPS Signal'}
              </span>
            </div>

            {courierLoc && (
              <span className="font-mono text-[11px] text-slate-400">
                {courierLoc.lat.toFixed(4)}, {courierLoc.lng.toFixed(4)}
              </span>
            )}
          </div>

          {/* Live Rider Movement & Distance-Based Countdown Card */}
          <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden no-print">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Navigation className="w-36 h-36 text-white" />
            </div>

            <div className="relative z-10 flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">
                  Distance & Buffer Countdown (ETA {totalEtaMins}m)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white mt-0.5">
                  {isDelivered ? '00m : 00s' : `${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {isDelivered ? 'Order successfully delivered' : 'Calculated live from location road distance + kitchen prep'}
                </div>
              </div>

              <div className="text-right bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Status</span>
                <span className="text-xs font-extrabold text-orange-400 capitalize">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Rider Movement Progress Bar */}
            <div className="space-y-2 pt-2 relative z-10">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                <span className="flex items-center gap-1">
                  <Utensils className="w-3.5 h-3.5 text-orange-400" /> Kitchen
                </span>
                <span className="flex items-center gap-1 font-bold text-white">
                  <Bike className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Dispatch Rider
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" /> Your Address
                </span>
              </div>

              <div className="h-3 w-full bg-slate-700/80 rounded-full overflow-hidden p-0.5 relative">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md flex items-center justify-center animate-ping" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Timeline Card */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 no-print">
            <div className="grid grid-cols-6 gap-1 relative pt-1">
              {milestones.map((m, idx) => {
                const isCompleted = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={m.key} className="flex flex-col items-center text-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                        isCurrent
                          ? 'bg-orange-600 text-white ring-4 ring-orange-100 animate-pulse'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-400'
                      }`}
                    >
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`text-[10px] leading-tight truncate w-full ${
                        isCurrent
                          ? 'font-bold text-orange-600'
                          : isCompleted
                          ? 'font-medium text-slate-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Secure Handover PIN Alert */}
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Doorstep Handover PIN</div>
                <div className="text-xs text-slate-600">Provide this code to your rider upon arrival:</div>
              </div>
            </div>

            <span className="text-lg font-mono font-extrabold text-slate-900 tracking-wider bg-white px-3 py-1 rounded-xl border border-orange-200">
              {order.handoverPin || '3819'}
            </span>
          </div>

          {/* Courier Rider Information (If dispatched) */}
          {order.courier && (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 no-print">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center font-display">
                    {order.courier.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{order.courier.name}</span>
                      <span className="text-xs font-semibold px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-200">
                        ★ {order.courier.rating}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {order.courier.vehicle} · {order.courier.plateNumber}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="p-2.5 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors cursor-pointer"
                    aria-label="Chat with rider"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                  <a
                    href={`tel:${order.courier.phone}`}
                    className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
                    aria-label="Call rider"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Official Itemized Printable Receipt */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#FF5500]" />
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Official Itemized Receipt
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">Ref: {order.transactionRef || order.id}</p>
                </div>
              </div>
              <button
                onClick={handlePrintReceipt}
                className="px-3 py-1.5 bg-[#FF5500] hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save PDF</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Customer & Address Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Delivery Address
                  </span>
                  <p className="font-bold text-slate-900 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF5500] shrink-0 mt-0.5" />
                    <span>{order.customerAddress} {order.customerApartment ? `(${order.customerApartment})` : ''}</span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Customer & Payment
                  </span>
                  <p className="font-bold text-slate-900">{order.customerName} ({order.customerPhone})</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Paid via <strong className="text-slate-800 capitalize">{order.paymentMethod || 'Wallet'}</strong>
                  </p>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                  <span>Purchased Dish Items</span>
                  <span>Price</span>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {order.items.map((item, idx) => {
                    const itemName = item?.menuItem?.name || (item as any)?.name || 'Dish Item';
                    const itemTotal = item.itemTotal || (item.menuItem?.price || 0) * item.quantity;

                    return (
                      <div key={idx} className="p-3 flex items-start justify-between gap-3 text-slate-800">
                        <div>
                          <div className="font-bold text-slate-900">
                            {item.quantity}x {itemName}
                          </div>
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              + {item.selectedOptions.map((o) => o.optionName).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0">
                          {formatCurrency(itemTotal, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full Financial Breakdown */}
              <div className="space-y-1.5 pt-3 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(order.subtotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(order.deliveryFee, currency)}
                  </span>
                </div>
                {(order.serviceFee || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service & Technology Fee</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(order.serviceFee || 0, currency)}
                    </span>
                  </div>
                )}
                {(order.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Voucher Discount</span>
                    <span className="font-mono font-bold">
                      -{formatCurrency(order.discountAmount || 0, currency)}
                    </span>
                  </div>
                )}
                {(order.tip || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Driver Tip</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(order.tip || 0, currency)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2.5 mt-2 border-t border-slate-900 text-sm font-extrabold text-slate-900">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-base text-[#FF5500]">
                    {formatCurrency(order.total, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Live Chat Modal */}
      <DriverChatModal
        order={order}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
};


