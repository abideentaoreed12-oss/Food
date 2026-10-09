import React, { useState, useEffect, useRef } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import { SpecialActionButton } from '../shared/SpecialActionButton';
import {
  Bike,
  Navigation,
  MapPin,
  Store,
  Phone,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Award,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Package,
  Radio
} from 'lucide-react';

export const CourierView: React.FC = () => {
  const {
    orders,
    advanceOrderStatus,
    verifyOrderHandover,
    currency
  } = useDelivery();

  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Live GPS Transmitter States
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; heading?: number; speed?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'transmitting' | 'acquiring' | 'error'>('acquiring');
  const [pingCount, setPingCount] = useState<number>(0);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Find assigned active order for courier
  const activeDelivery = orders.find(
    (o) => o.status === 'in_transit' || o.status === 'ready_for_pickup' || o.status === 'preparing'
  ) || orders.find((o) => o.status === 'delivered') || orders[0];

  const readyForPickupOrders = orders.filter((o) => o.status === 'ready_for_pickup');

  // Real-Time HTML5 Driver Geolocation Watcher & Production Backend Broadcast
  useEffect(() => {
    if (!isOnline) {
      setGpsStatus('acquiring');
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsStatus('error');
      setGpsErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    const sendLocationUpdate = async (lat: number, lng: number, heading = 0, speed = 0) => {
      if (!user?.id || !activeDelivery?.id) {
        setGpsStatus('error');
        setGpsErrorMsg('Sign in as an assigned courier and open an active delivery before sharing location.');
        return;
      }
      try {
        const response = await fetch('/api/couriers/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courierId: user.id,
            orderId: activeDelivery.id,
            lat,
            lng,
            heading,
            speed
          })
        });
        if (!response.ok) {
          setGpsStatus('error');
          setGpsErrorMsg('The server rejected the location update. Please retry.');
          return;
        }
        setPingCount((prev) => prev + 1);
        setGpsStatus('transmitting');
        setGpsErrorMsg(null);
      } catch (err) {
        setGpsStatus('error');
        setGpsErrorMsg('Could not send your location. Check your connection.');
        console.warn('Courier location broadcast error');
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        setCurrentCoords({ lat: latitude, lng: longitude, heading: heading || 0, speed: speed || 0 });
        sendLocationUpdate(latitude, longitude, heading || 0, speed || 0);
      },
      (error) => {
        console.warn('GPS position error:', error.message);
        setGpsStatus('error');
        setGpsErrorMsg(error.message || 'GPS permission denied or unavailable');
        // Never publish simulated coordinates as live courier telemetry.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, activeDelivery?.id, user?.id]);

  const handleVerifyHandover = async () => {
    if (!activeDelivery || !enteredPin.trim()) return;

    setIsVerifying(true);
    setPinError(null);
    try {
      const success = await verifyOrderHandover(activeDelivery.id, enteredPin.trim());
      if (!success) {
        setPinError('Invalid handover PIN. Please ask customer for their 4-digit code.');
      } else {
        setEnteredPin('');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const displayName = user?.name || 'Tunde Adeleke';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="space-y-6 pb-16">
      <SpecialActionButton />
      {/* Courier Rider Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5500] to-amber-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg font-display">
              {displayInitial}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-slate-900 ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <span>Logistics Transit Network</span>
              <span className="text-slate-600">·</span>
              <span className={isOnline ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {isOnline ? 'Online & Ready for Runs' : 'Offline (Shift Paused)'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {displayName}
            </h1>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Transit ID: {user?.id || 'RIDER-842-IK'} · Dedicated Courier Partner
            </div>
          </div>
        </div>

        {/* Online Toggle & Rider Shift Stats */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isOnline
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {isOnline ? '🟢 Available' : '⚪ Go Online'}
          </button>

          <div className="flex items-center gap-4 bg-slate-850 px-5 py-3 rounded-2xl border border-slate-750">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Shift Earnings</div>
              <div className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                {formatCurrency(14500, currency)}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Rider Rating</div>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ★ 4.94
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live GPS Telemetry Transmitter Indicator */}
      {isOnline && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Live GPS Broadcast Active</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 border border-emerald-700">
                  {pingCount} Pings Sent
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Current Position: {currentCoords?.lat.toFixed(5)}, {currentCoords?.lng.toFixed(5)} · Accuracy: High Precision HTML5 GPS
              </p>
            </div>
          </div>

          <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Broadcasting to Customer Tracking View</span>
          </div>
        </div>
      )}

      {/* Main Courier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Delivery Cockpit */}
        <div className="lg:col-span-2 space-y-6">
          {activeDelivery ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Order #{activeDelivery.shortId}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 capitalize">
                        {activeDelivery.status.replace('_', ' ')}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-mono font-bold text-slate-400">
                  Est. Delivery: <span className="text-white">{activeDelivery.estimatedArrivalMinutes} mins</span>
                </div>
              </div>

              {/* Waypoints: Pickup and Delivery */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <Store className="w-3.5 h-3.5" />
                    <span>Kitchen Pickup</span>
                  </div>
                  <div className="font-bold text-white text-sm">{activeDelivery.restaurantName}</div>
                  <div className="text-xs text-slate-400">Lekki Phase 1 Kitchen Hub, Lagos</div>
                  <div className="pt-2 text-xs text-slate-300 border-t border-slate-800 font-mono">
                    {activeDelivery.items.reduce((s, i) => s + i.quantity, 0)} Items · Sealed in Thermal Bag
                  </div>
                </div>

                <div className="p-4 bg-slate-850 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Customer Doorstep</span>
                  </div>
                  <div className="font-bold text-white text-sm">{activeDelivery.customerName}</div>
                  <div className="text-xs text-slate-400 truncate">{activeDelivery.customerAddress}</div>
                  <div className="pt-2 flex items-center justify-between text-xs text-slate-300 border-t border-slate-800">
                    <span className="font-mono">{activeDelivery.customerPhone}</span>
                    <a
                      href={`tel:${activeDelivery.customerPhone}`}
                      className="text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Handover PIN Section */}
              <div className="p-5 bg-gradient-to-r from-orange-950/40 via-slate-850 to-slate-850 rounded-2xl border border-orange-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                  <KeyRound className="w-4 h-4" />
                  <span>Doorstep Handover Verification</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ask customer for their 4-digit Handover PIN to confirm safe delivery:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={enteredPin}
                    onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 4-digit PIN"
                    className="w-44 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono font-extrabold text-lg text-white tracking-widest focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={handleVerifyHandover}
                    disabled={enteredPin.length !== 4 || isVerifying}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isVerifying ? 'Verifying PIN...' : 'Verify & Mark Delivered'}</span>
                  </button>
                </div>

                {pinError && (
                  <p className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              {/* Status progression quick buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {activeDelivery.status === 'ready_for_pickup' && (
                  <button
                    onClick={() => advanceOrderStatus(activeDelivery.id, 'in_transit')}
                    className="px-4 py-2.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Bike className="w-4 h-4" />
                    <span>Confirm Meal Pickup (Start Delivery)</span>
                  </button>
                )}
                {activeDelivery.status === 'in_transit' && (
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Order is on the way. Enter customer PIN above when handing over meal.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 space-y-2">
              <Bike className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-sm font-semibold text-slate-400">No active delivery run right now</p>
              <p className="text-xs text-slate-600">New dispatch requests will appear when kitchens finish preparing.</p>
            </div>
          )}
        </div>

        {/* Right Col: Ready for Pickup Queue & Stats */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Ready for Pickup ({readyForPickupOrders.length})</span>
            </div>

            <div className="space-y-2.5">
              {readyForPickupOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 bg-slate-850 rounded-2xl border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-xs">#{order.shortId}</span>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md">
                      Ready at Kitchen
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-semibold">{order.restaurantName}</div>
                  <div className="text-[11px] text-slate-400 truncate">{order.customerAddress}</div>
                  <button
                    onClick={() => advanceOrderStatus(order.id, 'in_transit')}
                    className="w-full mt-1 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Accept Run & Pick Up
                  </button>
                </div>
              ))}

              {readyForPickupOrders.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">
                  No orders currently waiting for rider pickup.
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-xs text-slate-400 space-y-2.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Doorstep Delivery Standards</span>
            </div>
            <p className="leading-relaxed">
              Veyrang insulated thermal bags maintain food temperature at 65°C+ for hot dishes throughout Lagos and Abuja transit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
