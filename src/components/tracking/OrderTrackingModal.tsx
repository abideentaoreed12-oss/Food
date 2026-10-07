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
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Receipt,
  Bell,
  Navigation
} from 'lucide-react';

export const OrderTrackingModal: React.FC = () => {
  const {
    isTrackingModalOpen,
    closeTracking,
    activeTrackingOrder,
    advanceOrderStatus,
    currency,
    setActivePage
  } = useDelivery();

  const { user, setIsAuthModalOpen } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showItems, setShowItems] = useState(false);

  // Live countdown timer state (seconds counting down)
  const [secondsLeft, setSecondsLeft] = useState((activeTrackingOrder?.estimatedArrivalMinutes || 18) * 60);
  const [notificationMsg, setNotificationMsg] = useState<string>(
    activeTrackingOrder?.status === 'in_transit'
      ? 'Rider Emeka is on the way with your order! ETA 14 mins.'
      : activeTrackingOrder?.status === 'preparing'
      ? 'Kitchen is freshly preparing your delicious meal.'
      : 'Order confirmed and successfully queued.'
  );

  useEffect(() => {
    if (!activeTrackingOrder || activeTrackingOrder.status === 'delivered') return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTrackingOrder?.status]);

  if (!user || !isTrackingModalOpen || !activeTrackingOrder) return null;

  const order = activeTrackingOrder;
  const isDelivered = order.status === 'delivered';

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

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

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-900">
        {/* Header bar */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Tracking & Dispatch</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>{order.restaurantName}</span>
              <span className="font-mono text-xs text-slate-400">({order.shortId})</span>
            </h2>
          </div>

          <button
            onClick={closeTracking}
            aria-label="Close tracking"
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
          {/* Instant Notification Banner */}
          <div className="p-3.5 rounded-2xl bg-orange-50/90 border border-orange-200 flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="flex-1 text-xs font-semibold text-orange-900">
              {notificationMsg}
            </div>
          </div>

          {/* Live Rider Movement & Countdown Card */}
          <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <Navigation className="w-36 h-36 text-white" />
            </div>

            <div className="relative z-10 flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">
                  Live Countdown Timer
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white mt-0.5">
                  {isDelivered ? '00m : 00s' : `${String(mins).padStart(2, '0')}m : ${String(secs).padStart(2, '0')}s`}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {isDelivered ? 'Order successfully delivered' : 'Estimated arrival at your doorstep'}
                </div>
              </div>

              <div className="text-right bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Status</span>
                <span className="text-xs font-extrabold text-orange-400 capitalize">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Rider Movement Progress Bar & Map Radar Animation */}
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
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
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
          <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between gap-3">
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
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
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

          {/* Itemized Receipt Summary Accordion */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
            <button
              onClick={() => setShowItems(!showItems)}
              className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" />
                <span>Order Summary ({order.items.reduce((s, i) => s + i.quantity, 0)} items)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="font-mono">{formatCurrency(order.total, currency)}</span>
                {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showItems && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-2 text-xs">
                {order.items.map((item) => (
                  <div key={item.cartItemId} className="flex justify-between items-start text-slate-700">
                    <div>
                      <span className="font-semibold">{item.quantity}x</span> {item?.menuItem?.name || (item as any)?.name || 'Order Item'}
                    </div>
                    <div className="font-mono tabular-nums">{formatCurrency(item.itemTotal, currency)}</div>
                  </div>
                ))}
              </div>
            )}
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
