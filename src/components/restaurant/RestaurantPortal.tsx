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
      setMenuMsg('');
    } catch (err: any) {
      setLiveMenu([]);
      setMenuMsg(err?.message || 'Could not load menu from D1');
    } finally {
      setMenuLoading(false);
    }
  }, [assignedRestaurantId]);

  useEffect(() => {
    if (activeTab === 'menu') loadLiveMenu();
  }, [activeTab, loadLiveMenu]);

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDishName.trim() || !newDishPrice || !assignedRestaurantId) return;
    setSavingDish(true);
    setMenuMsg('');
    try {
      const payload = {
        name: newDishName.trim(),
        price: Number(newDishPrice),
        description: newDishDesc.trim(),
        restaurantId: assignedRestaurantId,
        ...(editingDishId ? {} : { category: 'Main Dishes' }),
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
      setMenuMsg(editingDishId ? 'Dish updated in D1.' : 'Dish saved to D1 and the shared catalogue refreshed.');
      await loadLiveMenu();
    } catch (err: any) {
      setMenuMsg(err?.message || 'Failed to save dish');
    } finally {
      setSavingDish(false);
    }
  };

  const handleToggleDish = async (id: string) => {
    try {
      await api.admin.toggleMenuItem(id);
      await loadLiveMenu();
      setMenuMsg('Availability updated in D1.');
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
      <div className="min-h-[60vh] rounded-3xl border border-orange-100 bg-white p-8 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#F26322]">
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

      <div className="bg-white border border-orange-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 text-[#F26322] flex items-center justify-center shrink-0">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                : 'bg-slate-850 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {currentRestaurant.isBusyPaused ? '🔴 Busy (Paused)' : '🟢 Pause Orders (Busy Mode)'}
          </button>

          <span className="inline-flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800">
            <ShieldCheck className="h-4 w-4" />
            Assigned restaurant only
          </span>

          {/* Sub-view toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'tickets' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              Tickets ({restaurantOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'menu' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
              }`}
            >
              Stock ({liveMenu.length})
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'finance' ? 'bg-[#FF5500] text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-slate-900'
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
          <div className="text-xs text-slate-500 font-medium">Sales Volume</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
            {formatCurrency(totalKitchenRevenueUSD, currency)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Active Tickets</div>
          <div className="text-2xl font-bold text-white font-mono mt-1 tabular-nums">
            {newTickets.length + preparingTickets.length + readyTickets.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Platform Commission</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1 tabular-nums">
            {commissionRate}%
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-slate-400 font-medium">Doorstep Rating</div>
          <div className="text-2xl font-bold text-white font-mono mt-1 tabular-nums">
            ★ {currentRestaurant.rating.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tab 1: Live Kitchen Tickets */}
      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* New Incoming Tickets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                <h3 className="text-sm font-bold text-slate-900">New Tickets</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-orange-950 text-orange-400 px-2 py-0.5 rounded-full border border-orange-800">
                {newTickets.length}
              </span>
            </div>

            {newTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-850">
                No new pending tickets. Place an order from Customer view to trigger!
              </div>
            ) : (
              newTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border-2 border-orange-500/70 rounded-2xl p-4 space-y-3 shadow-lg animate-pulse"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{ord.shortId}</span>
                    <span className="text-orange-400 font-semibold">{ord.createdAt}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{ord.customerName}</span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {ord.fulfillmentType === 'pickup' ? 'Takeaway' : 'Doorstep'}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                    {ord.items.map((it) => (
                      <div key={it.cartItemId} className="flex justify-between">
                        <span>
                          <strong className="text-orange-400">{it.quantity}×</strong> {it?.menuItem?.name || (it as any)?.name || 'Item'}
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
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                      title="Print ticket"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => advanceOrderStatus(ord.id, 'preparing')}
                      className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors shadow-md"
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Cooking</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full border border-amber-800">
                {preparingTickets.length}
              </span>
            </div>

            {preparingTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-850">
                No orders currently in pans or ovens.
              </div>
            ) : (
              preparingTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{ord.shortId}</span>
                    <span className="text-amber-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {ord.prepTimeAdjustmentMin ? `+${ord.prepTimeAdjustmentMin}m added` : 'Preparing'}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-white">{ord.customerName}</div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                    {ord.items.map((it) => (
                      <div key={it.cartItemId} className="flex justify-between">
                        <span>
                          <strong className="text-amber-400">{it.quantity}×</strong> {it?.menuItem?.name || (it as any)?.name || 'Item'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Prep Time Adjusters */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Adjust prep time:</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => adjustOrderPrepTime(ord.id, 5)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-mono"
                      >
                        +5m
                      </button>
                      <button
                        onClick={() => adjustOrderPrepTime(ord.id, 10)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-mono"
                      >
                        +10m
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePrint(ord.shortId)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Ready for Pickup</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-blue-950 text-blue-400 px-2 py-0.5 rounded-full border border-blue-800">
                {readyTickets.length}
              </span>
            </div>

            {readyTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-850">
                All bagged meals handed to couriers or picked up.
              </div>
            ) : (
              readyTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border border-blue-500/40 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-white">{ord.shortId}</span>
                    <span className="text-blue-400 font-semibold">Packed & Insulated</span>
                  </div>

                  <div className="text-xs text-slate-300">
                    <div>
                      {ord.fulfillmentType === 'pickup' ? (
                        <span className="text-emerald-400 font-bold">Waiting for Customer Takeaway</span>
                      ) : (
                        <>Courier: <strong className="text-white">{ord.courier?.name || 'Rider Assigned'}</strong></>
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Dispatched</h3>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800">
                {inTransitTickets.length}
              </span>
            </div>

            {inTransitTickets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-850">
                No active orders currently dispatched.
              </div>
            ) : (
              inTransitTickets.map((ord) => (
                <div
                  key={ord.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">{ord.shortId}</span>
                    <span className={`font-semibold ${ord.status === 'delivered' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                      {ord.status === 'delivered' ? 'Delivered' : `En Route (${Math.round(ord.routeProgress)}%)`}
                    </span>
                  </div>

                  <div className="text-slate-300 truncate">
                    To: {ord.customerName} · {ord.customerAddress}
                  </div>

                  <button
                    onClick={() => openTracking(ord.id)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">Live Menu Stock Controller</h3>
            <p className="text-xs text-slate-400">
              Instantly toggle item availability (86 status) if kitchen ingredients run out. Changes update in customer storefronts immediately.
            </p>
          </div>

          {menuMsg ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-950">{menuMsg}</div>
          ) : null}

          <form onSubmit={handleCreateDish} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div className="md:col-span-4 text-sm font-bold text-slate-900">Add new dish (live D1 to admin to public catalogue)</div>
            <input required value={newDishName} onChange={(e) => setNewDishName(e.target.value)} placeholder="Dish name" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500" />
            <input required type="number" min={0} step={50} value={newDishPrice} onChange={(e) => setNewDishPrice(e.target.value)} placeholder="Price (NGN)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500" />
            <input value={newDishDesc} onChange={(e) => setNewDishDesc(e.target.value)} placeholder="Short description" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 md:col-span-2" />
            <button type="submit" disabled={savingDish} className="md:col-span-4 min-h-11 rounded-xl bg-[#FF5500] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#e64b00] focus:ring-2 focus:ring-orange-300 disabled:opacity-60">
              {savingDish ? 'Saving to D1' : editingDishId ? 'Update dish' : 'Save dish to D1'}
            </button>
          </form>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Your dishes</h4>
              <button type="button" onClick={loadLiveMenu} className="text-xs font-bold text-[#FF5500] hover:text-orange-400">Refresh</button>
            </div>
            {menuLoading ? (
              <p className="text-sm text-slate-600">Loading your dishes</p>
            ) : liveMenu.length === 0 ? (
              <p className="text-xs text-slate-300">No dishes in D1 yet. Add one above.</p>
            ) : (
              liveMenu.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-300">NGN {Number(item.price || 0).toLocaleString()} - {item.is_available === 0 ? 'Hidden' : 'Available'}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => { setEditingDishId(String(item.id)); setNewDishName(String(item.name || '')); setNewDishPrice(String(item.price ?? '')); setNewDishDesc(String(item.description || '')); setMenuMsg('Editing dish. Save changes to update D1.'); }} className="rounded-lg border border-slate-500 bg-slate-800 px-2.5 py-1 text-xs font-bold text-white hover:border-[#FF5500]">Edit</button>
                    <button type="button" onClick={() => handleToggleDish(item.id)} className="rounded-lg border border-slate-500 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 hover:border-[#FF5500] hover:text-[#FF5500]">
                      {item.is_available === 0 ? 'Restock' : 'Hide'}
                    </button>
                    <button type="button" onClick={async () => { if (!window.confirm('Delete this dish permanently?')) return; try { await api.admin.deleteMenuItem(String(item.id)); await loadLiveMenu(); setMenuMsg('Dish deleted from D1 and the shared catalogue refreshed.'); } catch (err: any) { setMenuMsg(err?.message || 'Could not delete dish.'); } }} className="rounded-lg border border-rose-700 bg-rose-950 px-2.5 py-1 text-xs font-bold text-rose-200 hover:bg-rose-900">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>


          <div className="space-y-6">
            {currentRestaurant.categories.map((cat) => (
              <div key={cat.id} className="space-y-3">
                <h4 className="text-sm font-bold text-orange-400 pb-1 border-b border-slate-800">
                  {cat.name}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 bg-slate-850 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs sm:text-sm truncate">
                          {it.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Merchant Payouts & Settlement Schedule</h3>
              <p className="text-xs text-slate-400">
                Automated weekly bank disbursements with itemized platform commission deduction
              </p>
            </div>
            <div className="px-3 py-1 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified Merchant Payout Account</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Gross Food Sales</span>
              <div className="text-xl font-bold font-mono text-white">
                {formatCurrency(totalKitchenRevenueUSD, currency)}
              </div>
            </div>
            <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Platform Commission ({commissionRate}%)</span>
              <div className="text-xl font-bold font-mono text-rose-400">
                -{formatCurrency(platformFeeUSD, currency)}
              </div>
            </div>
            <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400">Net Scheduled Payout</span>
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
