import React, { useState, useMemo } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import { Order, OrderStatus } from '../../types';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  User,
  ShieldCheck,
  ArrowRight,
  Search,
  Receipt,
  Printer,
  Download,
  Calendar,
  MapPin,
  CreditCard,
  Tag,
  Filter,
  DollarSign,
  Utensils,
  Star
} from 'lucide-react';
import { OrderReviewModal } from '../reviews/OrderReviewModal';

export const OrdersPage: React.FC = () => {
  const { orders, openTracking, reorderPastOrder, currency, setActivePage } = useDelivery();
  const { user, loading, setIsAuthModalOpen } = useAuth();

  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<Order | null>(null);

  // Filter orders associated with the authenticated user session
  const safeOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (!o) return false;
      if (!user) return true; // Show all session orders if guest
      return (
        o.customerId === user.id ||
        o.customerPhone === user.phone ||
        o.customerName === user.name
      );
    });
  }, [orders, user]);

  // Separate active orders (placed, confirmed, preparing, ready, in_transit) vs past orders (delivered, cancelled)
  const activeOrders = useMemo(() => {
    return safeOrders.filter(
      (o) => o && o.status !== 'delivered' && o.status !== 'cancelled'
    );
  }, [safeOrders]);

  const pastOrders = useMemo(() => {
    return safeOrders.filter((o) => {
      if (!o) return false;
      const isPast = o.status === 'delivered' || o.status === 'cancelled';
      if (!isPast) return false;

      // Status filter
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;

      // Search query filter (search by restaurant name, shortId, or item names)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRest = o.restaurantName?.toLowerCase().includes(q);
        const matchId = o.shortId?.toLowerCase().includes(q) || o.id?.toLowerCase().includes(q);
        const matchItems = (o.items || []).some(
          (i) => i?.menuItem?.name?.toLowerCase().includes(q) || (i as any)?.name?.toLowerCase().includes(q)
        );
        return matchRest || matchId || matchItems;
      }

      return true;
    });
  }, [safeOrders, statusFilter, searchQuery]);

  const toggleReceipt = (orderId: string) => {
    setExpandedReceiptId((prev) => (prev === orderId ? null : orderId));
  };

  const getStatusStepIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'placed':
        return 0;
      case 'confirmed':
        return 1;
      case 'preparing':
        return 2;
      case 'ready_for_pickup':
        return 3;
      case 'in_transit':
        return 4;
      case 'delivered':
        return 5;
      default:
        return 0;
    }
  };

  const steps: { key: OrderStatus; label: string }[] = [
    { key: 'placed', label: 'Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready_for_pickup', label: 'Ready' },
    { key: 'in_transit', label: 'On the way' },
    { key: 'delivered', label: 'Delivered' }
  ];

  if (loading) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-[#FF5500] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Verifying session...</p>
      </div>
    );
  }

  // STRICT ACCESS CONTROL: Non-logged-in users must sign in directly
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xl text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center mx-auto shadow-xs">
          <ShoppingBag className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Sign In to View Your Orders
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Please sign in or create an account to view your live meal deliveries, track courier GPS dispatch, and reorder past dishes with receipts.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <User className="w-4 h-4" />
            <span>Sign In / Create Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Encrypted Live Dispatch & Security PIN Handover</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
              My Orders & Receipts
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified User
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track active live deliveries and inspect full receipts for past completed orders
          </p>
        </div>

        <button
          onClick={() => setActivePage('restaurants')}
          className="px-4 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF5500] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Explore Restaurants</span>
        </button>
      </div>

      {/* Active Orders Section */}
      {activeOrders.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#FF5500] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] animate-ping" />
            <span>Active Live Orders ({activeOrders.length})</span>
          </div>

          {activeOrders.map((order) => {
            const currentStepIdx = getStatusStepIndex(order.status);

            return (
              <div
                key={order.id}
                className="rounded-3xl bg-white border border-orange-200/90 p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 font-mono">
                        {order.shortId}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 capitalize border border-orange-200/60">
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      {order.restaurantName || 'Kitchen'} · {(order.items || []).reduce((s, i) => s + (i?.quantity || 1), 0)} item{(order.items || []).reduce((s, i) => s + (i?.quantity || 1), 0) > 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatCurrency(order.total, order.currency || currency)}
                    </span>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{order.createdAt}</span>
                    </p>
                  </div>
                </div>

                {/* Progress Stepper */}
                <div className="py-1">
                  <div className="grid grid-cols-6 gap-1">
                    {steps.map((step, idx) => {
                      const isCompleted = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;

                      return (
                        <div key={step.key} className="text-center space-y-1">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isCompleted
                                ? 'bg-[#FF5500]'
                                : 'bg-slate-100'
                            }`}
                          />
                          <span
                            className={`text-[10px] block truncate font-semibold ${
                              isCurrent
                                ? 'text-[#FF5500] font-extrabold'
                                : isCompleted
                                ? 'text-slate-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Handover PIN Code & ETA */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/80 border border-orange-200/70 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#FF5500]" />
                    <div>
                      <span className="text-slate-500">Security PIN: </span>
                      <span className="font-mono font-extrabold text-slate-900 tracking-wider">
                        {order.handoverPin || '3819'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-orange-950 font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#FF5500]" />
                    <span>ETA: {order.estimatedArrivalMinutes} min</span>
                  </div>
                </div>

                {/* CTA Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openTracking(order.id)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5500] text-white text-xs font-bold hover:bg-[#EA4C00] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>View Tracking Cockpit</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setActivePage('help')}
                    className="py-2.5 px-3.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Help</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Past Orders & History Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-slate-400" />
            <span>Past Order History ({pastOrders.length})</span>
          </h2>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dish or restaurant..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF5500]"
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('delivered')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'delivered'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Delivered
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'cancelled'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>
        </div>

        {pastOrders.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 bg-white space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto stroke-[1.5]" />
            <p className="text-sm font-bold text-slate-800">No past orders match your search</p>
            <p className="text-xs text-slate-400">Your completed or cancelled meal deliveries will appear here with full receipt breakdowns.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastOrders.map((order) => {
              const isDelivered = order.status === 'delivered';
              const isCancelled = order.status === 'cancelled';
              const isExpanded = expandedReceiptId === order.id;

              return (
                <div
                  key={order.id}
                  className="rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all overflow-hidden"
                >
                  {/* Order Overview Header */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-slate-900">
                          {order.restaurantName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded-md">
                          {order.shortId}
                        </span>

                        {isDelivered ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Delivered</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Cancelled</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md capitalize">
                            {order.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      {/* Items List Preview */}
                      <div className="text-xs text-slate-600 line-clamp-1">
                        {(order.items || [])
                          .map((i) => {
                            const name = i?.menuItem?.name || (i as any)?.name || 'Dish';
                            const opts = (i.selectedOptions || []).map((o) => o.optionName).join(', ');
                            return `${i?.quantity || 1}x ${name}${opts ? ` (${opts})` : ''}`;
                          })
                          .join(', ') || 'Meal Order'}
                      </div>

                      {/* Metadata: Date & Final Receipt Price */}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{order.createdAt}</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          <span>{order.paymentMethod || 'Card'}</span>
                        </span>
                        <span>·</span>
                        <span className="font-extrabold text-slate-900 font-mono text-sm">
                          {formatCurrency(order.total, order.currency || currency)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="w-full sm:w-auto flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      {isDelivered && (
                        <button
                          onClick={() => setSelectedReviewOrder(order)}
                          className="py-2 px-3.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                          <span>Rate & Review</span>
                        </button>
                      )}

                      <button
                        onClick={() => reorderPastOrder(order)}
                        className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl bg-orange-50 text-[#FF5500] text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reorder</span>
                      </button>

                      <button
                        onClick={() => toggleReceipt(order.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isExpanded
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Final Receipt Breakdown Drawer */}
                  {isExpanded && (
                    <div className="printable-receipt border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-[#FF5500]" />
                          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            Official Itemized Receipt
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-500">
                            Ref: {order.transactionRef || order.id}
                          </span>
                          <button
                            onClick={() => window.print()}
                            className="no-print px-2.5 py-1 bg-[#FF5500] hover:bg-orange-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Save PDF</span>
                          </button>
                        </div>
                      </div>

                      {/* Customer & Delivery Destination Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-2xl border border-slate-200/80">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Delivery Address
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                            <span>{order.customerAddress} {order.customerApartment ? `(${order.customerApartment})` : ''}</span>
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Payment & Recipient
                          </span>
                          <p className="font-semibold text-slate-800">
                            {order.customerName} ({order.customerPhone})
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Paid via <strong className="text-slate-700">{order.paymentMethod}</strong> ({order.paymentStatus || 'paid'})
                          </p>
                        </div>
                      </div>

                      {/* Items Receipt Table */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Purchased Items
                        </span>
                        <div className="divide-y divide-slate-200/60 bg-white rounded-2xl border border-slate-200/80 overflow-hidden text-xs">
                          {(order.items || []).map((item, idx) => {
                            const itemName = item?.menuItem?.name || (item as any)?.name || 'Dish';
                            const itemPrice = item?.itemTotal || (item?.menuItem?.price || 0) * (item?.quantity || 1);

                            return (
                              <div key={idx} className="p-3 flex items-center justify-between gap-3">
                                <div>
                                  <span className="font-bold text-slate-900">
                                    {item.quantity}x {itemName}
                                  </span>
                                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      + {item.selectedOptions.map((o) => o.optionName).join(', ')}
                                    </p>
                                  )}
                                </div>
                                <span className="font-mono font-bold text-slate-900 shrink-0">
                                  {formatCurrency(itemPrice, order.currency || currency)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Financial Charges Breakdown */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/80 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Items Subtotal</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(order.subtotal, order.currency || currency)}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <span>Delivery Fee</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(order.deliveryFee, order.currency || currency)}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-600">
                          <span>Service & Technology Fee</span>
                          <span className="font-mono font-medium">
                            {formatCurrency(order.serviceFee, order.currency || currency)}
                          </span>
                        </div>

                        {order.tip > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Courier Driver Tip</span>
                            <span className="font-mono font-medium">
                              {formatCurrency(order.tip, order.currency || currency)}
                            </span>
                          </div>
                        )}

                        {order.discountAmount && order.discountAmount > 0 ? (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Promo Discount ({order.promoCode})</span>
                            <span className="font-mono">
                              - {formatCurrency(order.discountAmount, order.currency || currency)}
                            </span>
                          </div>
                        ) : null}

                        {order.walletDeduction && order.walletDeduction > 0 ? (
                          <div className="flex justify-between text-orange-700 font-bold">
                            <span>Wallet Balance Applied</span>
                            <span className="font-mono">
                              - {formatCurrency(order.walletDeduction, order.currency || currency)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-2 border-t border-slate-300">
                          <span>Final Receipt Price Paid</span>
                          <span className="font-mono text-base text-[#FF5500]">
                            {formatCurrency(order.total, order.currency || currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Platform D1 Review Submission Modal */}
      {selectedReviewOrder && (
        <OrderReviewModal
          order={selectedReviewOrder}
          isOpen={Boolean(selectedReviewOrder)}
          onClose={() => setSelectedReviewOrder(null)}
        />
      )}
    </div>
  );
};
