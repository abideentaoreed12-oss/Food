import React, { useState, useEffect, useCallback } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus } from '../../types';
import { formatCurrency } from '../../utils/format';
import {
  Utensils,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  DollarSign,
  ChefHat,
  Bike,
  ToggleLeft,
  ToggleRight,
  Printer,
  Volume2,
  Calendar,
  Percent,
  ShieldCheck
} from 'lucide-react';

import { SpecialActionButton } from '../shared/SpecialActionButton';
import { api } from '../../services/api';

export const RestaurantPortal: React.FC = () => {
  const { user } = useAuth();
  const {
    restaurants,
    orders,
    refreshData,
    advanceOrderStatus,
    adjustOrderPrepTime,
    updateItemAvailability,
    setBusyMode,
    openTracking,
    currency
  } = useDelivery();

  const [activeTab, setActiveTab] = useState<'tickets' | 'menu' | 'finance'>('tickets');
  const [ticketPrinted, setTicketPrinted] = useState<string | null>(null);
  const [liveMenu, setLiveMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuMsg, setMenuMsg] = useState('');
  const [newDishName, setNewDishName] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('');
  const [newDishDesc, setNewDishDesc] = useState('');
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [newDishCategoryId, setNewDishCategoryId] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [availableCouriers, setAvailableCouriers] = useState<any[]>([]);
  const [selectedCourierByOrder, setSelectedCourierByOrder] = useState<Record<string, string>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [savingDish, setSavingDish] = useState(false);
  const [editingDishId, setEditingDishId] = useState<string | null>(null);

  // Restaurant accounts are scoped to the restaurant assigned by an administrator.
  // Never default to restaurants[0] or allow a merchant to switch into another business.
  const assignedRestaurantId = user?.restaurantId;
  const currentRestaurant = assignedRestaurantId
    ? restaurants.find((r) => r.id === assignedRestaurantId)
    : undefined;

  const restaurantOrders = currentRestaurant
    ? orders.filter((o) => o.restaurantId === currentRestaurant.id)
    : [];

  const loadLiveMenu = useCallback(async () => {
    if (!assignedRestaurantId) return;
    setMenuLoading(true);
    try {
      const res: any = await api.admin.getMenuItems();
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setLiveMenu(rows);
      const categoriesRes: any = await api.admin.getCategories();
      const categories = Array.isArray(categoriesRes?.data) ? categoriesRes.data : Array.isArray(categoriesRes) ? categoriesRes : [];
      setMenuCategories(categories);
      setNewDishCategoryId((current) => current || String(categories[0]?.id || ''));
      setMenuMsg('');
    } catch (err: any) {
      setLiveMenu([]);
      setMenuMsg(err?.message || 'Could not load menu');
    } finally {
      setMenuLoading(false);
    }
  }, [assignedRestaurantId]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (activeTab === 'menu') {
        await loadLiveMenu();
      } else if (activeTab === 'tickets') {
        try {
          const res: any = await api.admin.getAvailableCouriers();
          if (isMounted) {
            const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            setAvailableCouriers(rows);
          }
        } catch (err: any) {
          if (isMounted) {
            setMenuMsg(err?.message || 'Could not load courier list.');
          }
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [activeTab, loadLiveMenu]);

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim() || !newDishPrice || !assignedRestaurantId || !newDishCategoryId) {
      setMenuMsg('Enter a dish name and valid price, then choose a category before saving.');
      return;
    }
    setSavingDish(true);
    setMenuMsg('');
    try {
      const payload = {
        name: newDishName.trim(),
        price: Number(newDishPrice),
        description: newDishDesc.trim(),
        restaurantId: assignedRestaurantId,
        categoryId: newDishCategoryId,
      };
      if (editingDishId) {
        await api.admin.updateMenuItem(editingDishId, payload);
      } else {
        await api.admin.createMenuItem(payload);
      }
      setNewDishName('');
      setNewDishPrice('');
      setNewDishDesc('');
      setEditingDishId(null);
      setMenuMsg(editingDishId ? 'Dish updated successfully.' : 'Dish saved and the shared catalogue refreshed.');
      await loadLiveMenu();
      await refreshData();
    } catch (err: any) {
      setMenuMsg(err?.message || 'Failed to save dish');
    } finally {
      setSavingDish(false);
    }
  };

  const handleAssignCourier = async (orderId: string) => {
    const courierId = selectedCourierByOrder[orderId];
    if (!courierId) {
      setMenuMsg('Select a courier before assigning the order.');
      return;
    }
    setAssigningOrderId(orderId);
    try {
      await api.admin.assignCourier(orderId, courierId);
      setMenuMsg('Courier assigned and recorded. Confirm handover separately when the courier collects the order.');
      await refreshData();
    } catch (err: any) {
      setMenuMsg(err?.message || 'Courier assignment failed.');
    } finally {
      setAssigningOrderId(null);
    }
  };

  const handleToggleDish = async (id: string) => {
    try {
      await api.admin.toggleMenuItem(id);
      await loadLiveMenu();
      await refreshData();
      setMenuMsg('Availability updated.');
    } catch (err: any) {
      setMenuMsg(err?.message || 'Toggle failed');
    }
  };


  const newTickets = restaurantOrders.filter((o) => o.status === 'placed');
  const preparingTickets = restaurantOrders.filter(
    (o) => o.status === 'confirmed' || o.status === 'preparing'
  );
  const readyTickets = restaurantOrders.filter((o) => o.status === 'ready_for_pickup');
  const inTransitTickets = restaurantOrders.filter(
    (o) => o.status === 'in_transit' || o.status === 'delivered'
  );

  const totalKitchenRevenueUSD = restaurantOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const commissionRate = currentRestaurant?.commissionPercent ?? 15;
  const platformFeeUSD = Math.round(totalKitchenRevenueUSD * (commissionRate / 100) * 100) / 100;
  const netPayoutUSD = Math.round((totalKitchenRevenueUSD - platformFeeUSD) * 100) / 100;

  const handlePrint = (orderId: string) => {
    setTicketPrinted(orderId);
    setTimeout(() => setTicketPrinted(null), 3000);
  };

  if (!assignedRestaurantId || !currentRestaurant) {
    return (
      <div className="min-h-[60vh] rounded-3xl border border-[#E8F5EF] bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F4F9F6] text-[#F26322]">
          <ChefHat className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Your restaurant workspace is being set up</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
          Your account is not linked to a restaurant yet. Please ask the Veyrang administrator to assign an existing restaurant or create one for your account. No other restaurant data is available to this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 text-slate-900">
      <SpecialActionButton />
      {/* Portal Top Bar */}

      <div className="bg-white border border-[#E8F5EF] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F9F6] border border-[#E8F5EF] text-[#F26322] flex items-center justify-center shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <span>Merchant Kitchen Display (KDS)</span>
              <span className="text-slate-600">·</span>
              {currentRestaurant.isBusyPaused ? (
                <span className="text-rose-400 font-bold">Busy Mode (Orders Paused)</span>
              ) : (
                <span className="text-emerald-400 font-bold">Accepting Orders</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <span>{currentRestaurant.name}</span>
            </h1>
          </div>
        </div>

        {/* Controls: Kitchen Switcher, Busy Mode, View Tabs */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Busy Mode Toggle */}
          <button
            onClick={() => setBusyMode(currentRestaurant.id, !currentRestaurant.isBusyPaused)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              currentRestaurant.isBusyPaused
                ? 'bg-rose-950 text-rose-300 border-rose-700'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:text-slate-900'
            }`}
          >
            {currentRestaurant.isBusyPaused ? '🔴 Busy (Paused)' : '🟢 Pause Orders (Busy Mode)'}
          </button>

          <span className="inline-flex items-center gap-2 rounded-xl border border-[#E8F5EF] bg-[#F4F9F6] px-3 py-2 text-xs font-bold text-[#041A14]">
            <ShieldCheck className="h-4 w-4" />
            Assigned restaurant only
          </span>

          {/* Sub-view toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'tickets' ? 'bg-[#0D4F3C] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              Tickets ({restaurantOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'menu' ? 'bg-[#0D4F3C] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              Stock ({liveMenu.length})
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'finance' ? 'bg-[#0D4F3C] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              Payouts
            </button>
          </div>
        </div>
      </div>

      {ticketPrinted && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Kitchen Ticket {ticketPrinted} sent to ESC/POS thermal printer simulation.</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-600 font-medium">Sales Volume</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
            {formatCurrency(totalKitchenRevenueUSD, currency)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-600 font-medium">Active Tickets</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {newTickets.length + preparingTickets.length + readyTickets.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-600 font-medium">Platform Commission</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1 tabular-nums">
            {commissionRate}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-600 font-medium">Doorstep Rating</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            ★ {currentRestaurant.rating.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tab 1: Live Kitchen Tickets */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* New Incoming Tickets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0D4F3C] animate-ping" />
                <h3 className="text-sm font-bold text-slate-900">New Tickets</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-[#02100C] text-[#126B54] px-2 py-0.5 rounded-full border border-[#041A14]">
                {newTickets.length}
              </span>
            </div>

            {newTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 bg-slate-50 rounded-2xl border border-slate-200">
                No new pending tickets. Place an order from Customer view to trigger!
              </div>
            ) : (
              newTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border-2 border-[#0D4F3C]/70 rounded-2xl p-4 space-y-3 shadow-lg animate-pulse"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{ord.shortId}</span>
                    <span className="text-[#126B54] font-semibold">{ord.createdAt}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{ord.customerName}</span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {ord.fulfillmentType === 'pickup' ? 'Takeaway' : 'Doorstep'}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    {ord.items.map((it) => (
                      <div key={it.cartItemId} className="flex justify-between">
                        <span>
                          <strong className="text-[#126B54]">{it.quantity}×</strong> {it?.menuItem?.name || (it as any)?.name || 'Item'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {ord.deliveryNotes && (
                    <div className="text-[11px] text-amber-300/90 italic bg-amber-950/30 p-2 rounded-lg border border-amber-900/40">
                      Note: "{ord.deliveryNotes}"
                    </div>
                  )}

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handlePrint(ord.shortId)}
                      className="p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl"
                      title="Print ticket"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => advanceOrderStatus(ord.id, 'preparing')}
                      className="flex-1 py-2 bg-[#093A2D] hover:bg-[#0D4F3C] text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                    >
                      Accept & Cook
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* In Kitchen Prep */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900">Cooking</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full border border-amber-800">
                {preparingTickets.length}
              </span>
            </div>

            {preparingTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 bg-slate-50 rounded-2xl border border-slate-200">
                No orders currently in pans or ovens.
              </div>
            ) : (
              preparingTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{ord.shortId}</span>
                    <span className="text-amber-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {ord.prepTimeAdjustmentMin ? `+${ord.prepTimeAdjustmentMin}m added` : 'Preparing'}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900">{ord.customerName}</div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    {ord.items.map((it) => (
                      <div key={it.cartItemId} className="flex justify-between">
                        <span>
                          <strong className="text-amber-400">{it.quantity}×</strong> {it?.menuItem?.name || (it as any)?.name || 'Item'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Prep Time Adjusters */}
                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                    <span>Adjust prep time:</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => adjustOrderPrepTime(ord.id, 5)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-700 text-amber-300 rounded font-mono"
                      >
                        +5m
                      </button>
                      <button
                        onClick={() => adjustOrderPrepTime(ord.id, 10)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-700 text-amber-300 rounded font-mono"
                      >
                        +10m
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrint(ord.shortId)}
                      className="p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl"
                      title="Print ticket"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => advanceOrderStatus(ord.id, 'ready_for_pickup')}
                      className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                    >
                      Mark Ready for Courier
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ready for Pickup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900">Ready for Pickup</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800">
                {readyTickets.length}
              </span>
            </div>

            {readyTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 bg-slate-50 rounded-2xl border border-slate-200">
                All bagged meals handed to couriers or picked up.
              </div>
            ) : (
              readyTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border border-blue-500/40 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-900">{ord.shortId}</span>
                    <span className="text-blue-400 font-semibold">Packed & Insulated</span>
                  </div>

                  {ord.fulfillmentType !== 'pickup' && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-100/70 p-3">
                      <label htmlFor={`courier-${ord.id}`} className="block text-xs font-semibold text-slate-200">Assign delivery courier</label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select id={`courier-${ord.id}`} value={selectedCourierByOrder[ord.id] || ''} onChange={(e) => setSelectedCourierByOrder((prev) => ({ ...prev, [ord.id]: e.target.value }))} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900">
                          <option value="">Select courier</option>
                          {availableCouriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                        </select>
                        <button type="button" onClick={() => handleAssignCourier(ord.id)} disabled={assigningOrderId === ord.id || !selectedCourierByOrder[ord.id]} className="min-h-10 rounded-lg bg-[#0D4F3C] px-3 py-2 text-xs font-bold text-slate-900 hover:bg-[#e64b00] disabled:opacity-50">{assigningOrderId === ord.id ? 'Assigning…' : 'Assign courier'}</button>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-slate-700">
                    <div>
                      {ord.fulfillmentType === 'pickup' ? (
                        <span className="text-emerald-400 font-bold">Waiting for Customer Takeaway</span>
                      ) : (
                        <>Courier: <strong className="text-slate-900">{ord.courier?.name || 'Rider Assigned'}</strong></>
                      )}
                    </div>
                    {ord.handoverPin && (
                      <div className="text-amber-400 font-mono mt-0.5">Required PIN: {ord.handoverPin}</div>
                    )}
                  </div>

                  <button
                    onClick={() => advanceOrderStatus(ord.id, ord.fulfillmentType === 'pickup' ? 'delivered' : 'in_transit')}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
                  >
                    {ord.fulfillmentType === 'pickup' ? 'Confirm Customer Handover' : 'Hand to Courier'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* En Route & Delivered */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900">Dispatched</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800">
                {inTransitTickets.length}
              </span>
            </div>

            {inTransitTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-600 bg-slate-50 rounded-2xl border border-slate-200">
                No active orders currently dispatched.
              </div>
            ) : (
              inTransitTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-sm text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{ord.shortId}</span>
                    <span className={`font-semibold ${ord.status === 'delivered' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {ord.status === 'delivered' ? 'Delivered' : `En Route (${Math.round(ord.routeProgress)}%)`}
                    </span>
                  </div>

                  <div className="text-slate-700 truncate">
                    To: {ord.customerName} · {ord.customerAddress}
                  </div>

                  <button
                    onClick={() => openTracking(ord.id)}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    View Live GPS Route
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Menu Stock & Availability Manager (86-list) */}
      {activeTab === 'menu' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Live Menu Stock Controller</h3>
            <p className="text-xs text-slate-600">
              Instantly toggle item availability (86 status) if kitchen ingredients run out. Changes update in customer storefronts immediately.
            </p>
          </div>

          {menuMsg ? (
            <div className="rounded-xl border border-[#CDEADF] bg-[#F4F9F6] px-3 py-2 text-xs font-semibold text-[#02100C]">{menuMsg}</div>
          ) : null}

          <form onSubmit={handleCreateDish} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div className="md:col-span-4 text-sm font-bold text-slate-900">Add new dish (syncs directly to live customer storefront)</div>
            <input required value={newDishName} onChange={(e) => setNewDishName(e.target.value)} placeholder="Dish name" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600" />
            <input required type="number" min={0} step={50} value={newDishPrice} onChange={(e) => setNewDishPrice(e.target.value)} placeholder="Price (NGN)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600" />
            <input value={newDishDesc} onChange={(e) => setNewDishDesc(e.target.value)} placeholder="Short description" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 md:col-span-2" />
            <div className="md:col-span-2">
              <label htmlFor="restaurant-dish-category" className="mb-1.5 block text-xs font-semibold text-slate-700">Category <span className="text-rose-600">*</span></label>
              <select id="restaurant-dish-category" required value={newDishCategoryId} onChange={(e) => setNewDishCategoryId(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#E8F5EF]">
                <option value="">Choose a category</option>
                {menuCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              {menuCategories.length === 0 && <p className="mt-1 text-xs text-amber-700">Create a category below before adding dishes.</p>}
            </div>
            <button type="submit" disabled={savingDish} className="md:col-span-4 min-h-11 rounded-xl bg-[#0D4F3C] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-[#e64b00] focus:ring-2 focus:ring-[#98D5C3] disabled:opacity-60">
              {savingDish ? 'Saving dish…' : editingDishId ? 'Update dish' : 'Save dish'}
            </button>
          </form>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const categoryName = newCategoryName.trim();
            if (!categoryName || !assignedRestaurantId) return;
            setSavingCategory(true);
            try {
              await api.admin.createCategory({ name: categoryName, restaurantId: assignedRestaurantId });
              const result: any = await api.admin.getCategories();
              const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
              setMenuCategories(rows);
              const created = rows.find((cat: any) => String(cat.name).toLowerCase() === categoryName.toLowerCase());
              if (created) setNewDishCategoryId(String(created.id));
              setNewCategoryName('');
              setMenuMsg('Category saved.');
              await refreshData();
            } catch (err: any) {
              setMenuMsg(err?.message || 'Could not create category.');
            } finally {
              setSavingCategory(false);
            }
          }} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="restaurant-new-category" className="mb-1.5 block text-xs font-semibold text-slate-700">Create a category</label>
              <input id="restaurant-new-category" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Rice dishes" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-600 focus:border-[#0D4F3C] focus:ring-2 focus:ring-[#E8F5EF]" />
            </div>
            <button type="submit" disabled={savingCategory || !newCategoryName.trim()} className="self-end min-h-11 rounded-xl border border-[#CDEADF] bg-white px-4 py-2 text-sm font-bold text-[#0D4F3C] hover:bg-[#F4F9F6] disabled:opacity-50">{savingCategory ? 'Saving…' : 'Add category'}</button>
          </form>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Your dishes</h4>
              <button type="button" onClick={loadLiveMenu} className="text-xs font-bold text-[#0D4F3C] hover:text-[#126B54]">Refresh</button>
            </div>
            {menuLoading ? (
              <p className="text-sm text-slate-600">Loading your dishes</p>
            ) : liveMenu.length === 0 ? (
              <p className="text-xs text-slate-700">No dishes in your menu yet. Add one above.</p>
            ) : (
              liveMenu.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-white px-3 py-2.5">
                  <div className="min-w-0">
                     <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
                     <div className="text-xs text-slate-700">NGN {Number(item.price || 0).toLocaleString()} - {item.is_available === 0 ? 'Hidden' : 'Available'}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => { setEditingDishId(String(item.id)); setNewDishName(String(item.name || '')); setNewDishPrice(String(item.price ?? '')); setNewDishDesc(String(item.description || '')); setNewDishCategoryId(String(item.category_id || '')); setMenuMsg('Editing dish. Save changes to update.'); }} className="rounded-lg border border-slate-500 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-900 hover:border-[#0D4F3C]">Edit</button>
                    <button type="button" onClick={() => handleToggleDish(item.id)} className="rounded-lg border border-slate-500 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 hover:border-[#0D4F3C] hover:text-[#0D4F3C]">
                      {item.is_available === 0 ? 'Restock' : 'Hide'}
                    </button>
                    <button type="button" onClick={async () => { if (!window.confirm('Delete this dish permanently?')) return; try { await api.admin.deleteMenuItem(String(item.id)); await loadLiveMenu(); await refreshData(); setMenuMsg('Dish deleted and catalogue refreshed.'); } catch (err: any) { setMenuMsg(err?.message || 'Could not delete dish.'); } }} className="rounded-lg border border-rose-700 bg-rose-950 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-rose-900">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>


          <div className="space-y-6">
            {(currentRestaurant.categories || []).map((cat) => (
              <div key={cat.id} className="space-y-3">
                <h4 className="text-sm font-bold text-[#126B54] pb-1 border-b border-slate-200">
                  {cat.name}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(cat.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                          {it.name}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono">
                          {formatCurrency(it.price, currency)} · {it.dietary.join(', ')}
                        </div>
                      </div>

                      <button
                        onClick={() => updateItemAvailability(currentRestaurant.id, it.id, !it.isAvailable)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          it.isAvailable
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                        }`}
                      >
                        {it.isAvailable ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-400" />
                            <span>Available</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-rose-400" />
                            <span>86'd (Sold Out)</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Finance & Payout Settlement Ledger */}
      {activeTab === 'finance' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Merchant Payouts & Settlement Schedule</h3>
              <p className="text-xs text-slate-600">
                Automated weekly bank disbursements with itemized platform commission deduction
              </p>
            </div>
            <div className="px-3 py-1 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Merchant Payout Account</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-600">Gross Food Sales</span>
              <div className="text-xl font-bold font-mono text-slate-900">
                {formatCurrency(totalKitchenRevenueUSD, currency)}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-600">Platform Commission ({commissionRate}%)</span>
              <div className="text-xl font-bold font-mono text-rose-400">
                -{formatCurrency(platformFeeUSD, currency)}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-xs text-slate-600">Net Scheduled Payout</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {formatCurrency(netPayoutUSD, currency)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
