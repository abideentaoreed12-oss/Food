import React, { useState, useMemo, useEffect } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatOrderTime, formatOrderDate } from '../../utils/format';
import { generateOrderReceiptPDF, printOrderReceiptWindow } from '../../utils/pdfGenerator';
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
  Star,
  ScanLine,
  Camera,
  X,
  QrCode
} from 'lucide-react';
import { OrderReviewModal } from '../reviews/OrderReviewModal';

export const OrdersPage: React.FC = () => {
  const { orders, openTracking, reorderPastOrder, currency, setActivePage } = useDelivery();
  const { user, loading, setIsAuthModalOpen } = useAuth();

  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'cancelled'>('all');
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<Order | null>(null);
  const [clockNow, setClockNow] = useState<number>(0);
  const [scanOrder, setScanOrder] = useState<Order | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [scanValue, setScanValue] = useState<string>('');
  const [cameraReady, setCameraReady] = useState(false);
  const [handoverBusy, setHandoverBusy] = useState(false);
  const [handoverUrl, setHandoverUrl] = useState('');
  const [handoverNotice, setHandoverNotice] = useState('');
  const [scanTab, setScanTab] = useState<'qr' | 'camera'>('qr');
  const [manualCode, setManualCode] = useState('');
  const [manualBusy, setManualBusy] = useState(false);
  const [manualSuccess, setManualSuccess] = useState('');

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const zxingControlsRef = React.useRef<any>(null);
  const qrContainerRef = React.useRef<HTMLDivElement | null>(null);

  const stopScanner = () => {
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch {}
      zxingControlsRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  // Render QR SVG whenever handoverUrl is generated
  useEffect(() => {
    if (handoverUrl && qrContainerRef.current) {
      import('@zxing/browser').then(({ BrowserQRCodeSvgWriter }) => {
        try {
          const writer = new BrowserQRCodeSvgWriter();
          const svg = writer.write(handoverUrl, 200, 200);
          if (qrContainerRef.current) {
            qrContainerRef.current.innerHTML = '';
            qrContainerRef.current.appendChild(svg);
          }
        } catch (e) {
          console.error('Failed to generate QR SVG', e);
        }
      }).catch(() => {});
    }
  }, [handoverUrl, scanTab]);

  const handleScannedResult = (raw: string) => {
    if (!raw) return;
    setScanValue(raw);
    stopScanner();

    // 1. Extract handover token from URL or raw string
    const match = raw.match(/\/handover\/([A-Za-z0-9_-]{30,100})/);
    if (match && match[1]) {
      window.location.assign(`/handover/${encodeURIComponent(match[1])}`);
      return;
    }

    // 2. Direct token string
    if (/^[A-Za-z0-9_-]{30,100}$/.test(raw.trim())) {
      window.location.assign(`/handover/${encodeURIComponent(raw.trim())}`);
      return;
    }

    // 3. Numeric Handover PIN (4-8 digits)
    if (scanOrder && /^\d{4,8}$/.test(raw.trim())) {
      setManualBusy(true);
      import('../../services/api').then(({ api }) => {
        api.orders.verifyHandover(scanOrder.id, raw.trim()).then((res: any) => {
          if (res?.success) {
            setManualSuccess('Delivery verified and confirmed!');
            setTimeout(() => {
              setScanOrder(null);
              window.location.reload();
            }, 1200);
          } else {
            setCameraError(res?.error || 'Invalid handover code.');
          }
        }).catch((err: any) => {
          setCameraError(err?.message || 'Handover verification failed.');
        }).finally(() => {
          setManualBusy(false);
        });
      });
      return;
    }

    setCameraError('Scanned code not recognized. Please scan a valid Veyrang handover QR or enter the 4-digit PIN below.');
  };

  const startCamera = async () => {
    setCameraError('');
    setScanValue('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires a supported browser and HTTPS.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);

      // Preferred: Native BarcodeDetector if available
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const intervalId = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                window.clearInterval(intervalId);
                handleScannedResult(barcodes[0].rawValue);
              }
            } catch {}
          }, 350);
          zxingControlsRef.current = { stop: () => window.clearInterval(intervalId) };
          return;
        } catch {}
      }

      // Universal Fallback: @zxing/browser continuous decoder
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
        if (result) {
          controls.stop();
          handleScannedResult(result.getText());
        }
      });
      zxingControlsRef.current = controls;
    } catch (error: any) {
      const name = error?.name;
      setCameraError(name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access in settings or enter the code manually below.'
        : 'Unable to access camera. Check device permissions or enter code manually.');
      stopScanner();
    }
  };

  const openScanner = async (order: Order) => {
    setScanOrder(order);
    setCameraError('');
    setScanValue('');
    setHandoverUrl('');
    setHandoverNotice('');
    setManualCode('');
    setManualSuccess('');
    setScanTab('qr'); // Default to showing the QR code and PIN first

    const isPaid = ['paid', 'completed'].includes(String(order.paymentStatus || '').toLowerCase());
    if (!isPaid) {
      setHandoverNotice('QR handover is unlocked after payment is confirmed.');
      setHandoverBusy(false);
      return;
    }

    setHandoverBusy(true);
    try {
      const { api } = await import('../../services/api');
      const issued: any = await api.orders.issueHandoverQr(order.id);
      const data = issued?.data || issued;
      if (data?.url) setHandoverUrl(String(data.url));
    } catch (error: any) {
      setHandoverNotice(error?.message || 'Could not load secure QR link. You can use your 4-digit PIN below.');
    } finally {
      setHandoverBusy(false);
    }
  };

  const handleManualVerify = async () => {
    if (!scanOrder || !manualCode.trim()) return;
    setManualBusy(true);
    setCameraError('');
    setManualSuccess('');
    try {
      const trimmed = manualCode.trim();
      const tokenMatch = trimmed.match(/\/handover\/([A-Za-z0-9_-]{30,100})/);
      if (tokenMatch && tokenMatch[1]) {
        window.location.assign(`/handover/${encodeURIComponent(tokenMatch[1])}`);
        return;
      }
      if (/^[A-Za-z0-9_-]{30,100}$/.test(trimmed)) {
        window.location.assign(`/handover/${encodeURIComponent(trimmed)}`);
        return;
      }
      if (/^\d{4,8}$/.test(trimmed)) {
        const { api } = await import('../../services/api');
        const res: any = await api.orders.verifyHandover(scanOrder.id, trimmed);
        if (res?.success) {
          setManualSuccess('Delivery verified and confirmed!');
          setTimeout(() => {
            stopScanner();
            setScanOrder(null);
            window.location.reload();
          }, 1200);
          return;
        } else {
          setCameraError(res?.error || 'Invalid handover code.');
        }
        return;
      }
      setCameraError('Enter a valid 4-digit PIN or paste the handover link.');
    } catch (err: any) {
      setCameraError(err?.message || 'Handover verification failed. Check code and retry.');
    } finally {
      setManualBusy(false);
    }
  };

  useEffect(() => () => {
    stopScanner();
  }, []);

  // Receipt/order ETA is a countdown from the server-created order timestamp,
  // not a static hardcoded display value.
  useEffect(() => {
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const getRemainingEtaMinutes = (order: Order): number => {
    if (order.status === 'awaiting_payment' || order.paymentStatus === 'pending') return -1;
    if (order.status === 'delivered' || order.status === 'cancelled') return 0;
    if (clockNow === 0) {
      const initialEta = Number(order.estimatedArrivalMinutes);
      return order.estimatedArrivalMinutes != null && Number.isFinite(initialEta) && initialEta >= 0 ? initialEta : -1;
    }
    const created = new Date(order.createdAt).getTime();
    const eta = Number(order.estimatedArrivalMinutes);
    if (!Number.isFinite(created) || !Number.isFinite(eta) || eta < 0) return -1;
    return Math.max(0, Math.ceil((created + eta * 60_000 - clockNow) / 60_000));
  };

  // Filter orders associated with the authenticated user session
  const safeOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (!o) return false;
      if (!user) return true; // Show all session orders if guest
      return (
        o.customerId === user.id ||
        o.customerId === 'guest' ||
        !o.customerId ||
        o.customerPhone === user.phone ||
        (o as any).customerEmail === user.email ||
        (o.customerName && user.name && o.customerName.toLowerCase() === user.name.toLowerCase()) ||
        user.role === 'customer'
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
                      <span>{formatOrderTime(order.createdAt)}</span>
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
                        {order.handoverPin || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-orange-950 font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#FF5500]" />
                    <span>{order.status === 'awaiting_payment' || order.paymentStatus === 'pending' ? 'Awaiting payment' : getRemainingEtaMinutes(order) < 0 ? 'ETA unavailable' : getRemainingEtaMinutes(order) === 0 ? 'ETA reached' : `ETA: ${getRemainingEtaMinutes(order)} min`}</span>
                  </div>
                </div>

                {/* CTA Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-[1.35fr_0.7fr_1fr] items-stretch gap-2 pt-1">
                  <button
                    onClick={() => openTracking(order.id)}
                    className="min-w-0 py-2.5 px-3 rounded-xl bg-[#FF5500] text-white text-xs font-bold hover:bg-[#EA4C00] transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>View Tracking Cockpit</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setActivePage('help')}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>Help</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void openScanner(order)}
                    disabled={!['paid', 'completed'].includes(String(order.paymentStatus || '').toLowerCase())}
                    title={!['paid', 'completed'].includes(String(order.paymentStatus || '').toLowerCase()) ? 'Handover QR is available once payment is confirmed' : 'Scan or view QR code for this order'}
                    className="py-2.5 px-3 rounded-xl border border-orange-200 bg-orange-50 text-[#FF5500] text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Scan QR code for order ${order.shortId}`}
                  >
                    <ScanLine className="w-3.5 h-3.5 shrink-0" />
                    <span>Scan Your Food</span>
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
                          <span>{formatOrderDate(order.createdAt)}</span>
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
                    <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-[#FF5500]" />
                          <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            Official Itemized Receipt
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500 mr-1">
                            Ref: {order.transactionRef || order.id}
                          </span>
                          <button
                            onClick={() => generateOrderReceiptPDF(order)}
                            className="px-2.5 py-1 bg-[#FF5500] hover:bg-orange-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save PDF</span>
                          </button>
                          <button
                            onClick={() => printOrderReceiptWindow(order)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Print window"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
                        </div>
                      </div>

                      {/* Merchant & Customer Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-2xl border border-slate-200/80">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Merchant & Date
                          </span>
                          <p className="font-semibold text-slate-900">
                            {order.restaurantName || 'Veyrang Partner Kitchen'}
                          </p>
                          <p className="text-[11px] text-slate-500" suppressHydrationWarning>
                            {order.createdAt ? new Date(order.createdAt).toLocaleString('en-NG') : 'Recent'}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Payment & Destination
                          </span>
                          <p className="font-semibold text-slate-800">
                            {order.customerName} ({order.customerPhone})
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#FF5500] shrink-0" />
                            <span>{order.customerAddress} {order.customerApartment ? `(${order.customerApartment})` : ''}</span>
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
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

      {scanOrder && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="food-qr-title">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-orange-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FF5500] text-white">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="food-qr-title" className="font-extrabold text-slate-900">Scan & Handover</h2>
                  <p className="text-xs text-slate-500 font-mono">Order {scanOrder.shortId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setScanOrder(null);
                }}
                className="rounded-xl p-2 text-slate-500 hover:bg-white cursor-pointer"
                aria-label="Close scanner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setScanTab('qr');
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanTab === 'qr'
                    ? 'bg-white text-[#FF5500] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Show Order QR & PIN</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScanTab('camera');
                  startCamera();
                }}
                className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  scanTab === 'camera'
                    ? 'bg-white text-[#FF5500] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Scan Camera</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-5 overflow-y-auto">
              {/* TAB 1: Display Order QR & PIN (To be shown to delivery courier or scanned) */}
              {scanTab === 'qr' && (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Official Delivery Handover Code
                    </p>

                    {/* SVG QR Code Container */}
                    <div className="flex justify-center items-center py-2">
                      {handoverBusy ? (
                        <div className="h-48 w-48 flex items-center justify-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
                          Generating QR code…
                        </div>
                      ) : (
                        <div
                          ref={qrContainerRef}
                          className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center"
                        />
                      )}
                    </div>

                    {/* 4-digit Handover PIN Display */}
                    <div className="p-3 bg-white rounded-xl border border-orange-200/80 inline-block w-full text-center">
                      <span className="text-xs text-slate-500 block mb-0.5 font-medium">Security Handover PIN</span>
                      <span className="font-mono text-2xl font-black tracking-widest text-[#FF5500]">
                        {scanOrder.handoverPin || '— — — —'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Show this QR code or 4-digit PIN to your rider upon arrival to confirm food handover.
                    </p>
                  </div>

                  {handoverUrl && (
                    <div className="flex items-center justify-between gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                      <span className="truncate text-left text-[11px] font-mono">{handoverUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(handoverUrl);
                          setHandoverNotice('Link copied! Valid for 30 minutes.');
                        }}
                        className="px-2.5 py-1 bg-white text-emerald-800 font-bold rounded-lg border border-emerald-300 text-[11px] shrink-0 cursor-pointer hover:bg-emerald-100"
                      >
                        Copy Link
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Camera Scanner */}
              {scanTab === 'camera' && (
                <div className="space-y-3">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-950">
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      aria-label="Camera QR scanner"
                    />
                    {!cameraReady && !cameraError && !scanValue && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                        <Camera className="h-10 w-10 text-orange-300 animate-pulse" />
                        <p className="text-sm font-semibold">Starting camera feed…</p>
                      </div>
                    )}
                    {cameraReady && (
                      <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-[#FF5500] shadow-[0_0_0_999px_rgba(0,0,0,0.25)]">
                        <span className="absolute -top-1 -left-1 h-5 w-5 border-l-4 border-t-4 border-orange-400" />
                        <span className="absolute -top-1 -right-1 h-5 w-5 border-r-4 border-t-4 border-orange-400" />
                        <span className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-orange-400" />
                        <span className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-orange-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 text-center">
                    Point camera at rider's handover QR code to scan automatically.
                  </p>
                </div>
              )}

              {/* Status and Error Messages */}
              {handoverNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  {handoverNotice}
                </div>
              )}
              {cameraError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  {cameraError}
                </div>
              )}
              {manualSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-bold text-emerald-800">
                  ✓ {manualSuccess}
                </div>
              )}

              {/* Manual PIN / Code Verification Form (Always available) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Or enter 4-digit PIN or handover code manually:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g. 5821 or token"
                    className="flex-1 bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#FF5500]"
                  />
                  <button
                    type="button"
                    onClick={handleManualVerify}
                    disabled={manualBusy || !manualCode.trim()}
                    className="px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {manualBusy ? 'Verifying…' : 'Confirm'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopScanner();
                    setScanOrder(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (scanTab === 'camera') {
                      startCamera();
                    } else {
                      openScanner(scanOrder);
                    }
                  }}
                  className="rounded-xl bg-[#FF5500] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#EA4C00] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>{scanTab === 'camera' ? 'Restart Camera' : 'Refresh QR'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
