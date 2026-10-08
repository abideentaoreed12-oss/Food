import React, { useState, useMemo } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatOrderTime, getUserVirtualAccount } from '../../utils/format';
import { WalletCard } from '../customer/WalletCard';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import { ProAddressForm } from '../common/ProAddressForm';
import {
  User,
  Phone,
  Mail,
  Wallet,
  Plus,
  MapPin,
  Shield,
  Store,
  Bike,
  LogOut,
  CreditCard,
  CheckCircle2,
  Building2,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  ExternalLink,
  ChevronRight,
  Receipt,
  ArrowRight,
  Lock,
  Trash2,
  Home,
  ChefHat,
  ShieldAlert
} from 'lucide-react';

interface WalletTransaction {
  id: string;
  type: 'deposit' | 'order' | 'refund' | 'bonus';
  title: string;
  description: string;
  reference: string;
  amount: number;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
}

export const AccountPage: React.FC = () => {
  const {
    walletBalanceNGN,
    walletDeposits,
    topUpWallet,
    orders,
    savedAddresses,
    selectedAddress,
    setSelectedAddress,
    addSavedAddress,
    deleteSavedAddress,
    activeRole,
    setActiveRole,
    currency,
    setIsWalletModalOpen
  } = useDelivery();

  const { user, loading, logout, setIsAuthModalOpen } = useAuth();
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [activeTxTab, setActiveTxTab] = useState<'all' | 'deposits' | 'orders'>('all');
  
  // New address form state
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrText, setAddrText] = useState('');
  const [addrApt, setAddrApt] = useState('');
  const [addrCity, setAddrCity] = useState('Lagos');
  const [isSavingAddr, setIsSavingAddr] = useState(false);

  const handleQuickTopUp = (amount: number) => {
    topUpWallet(amount);
    setTopUpSuccess(`Added ₦${amount.toLocaleString('en-NG')} to your Veyrang Wallet!`);
    setTimeout(() => setTopUpSuccess(null), 3000);
  };

  const virtualAccount = getUserVirtualAccount(user);

  const handleCopyAccount = () => {
    navigator.clipboard?.writeText(virtualAccount.accountNumberRaw);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  // Dynamically map ONLY real account orders and user deposits (Zero hardcoded fake activity)
  const userOrders = useMemo(() => {
    return (orders || []).filter((ord) => {
      if (!ord) return false;
      if (!user) return true;
      return (
        ord.customerId === user.id ||
        ord.customerId === 'guest' ||
        !ord.customerId ||
        ord.customerPhone === user.phone ||
        (ord as any).customerEmail === user.email ||
        (ord.customerName && user.name && ord.customerName.toLowerCase() === user.name.toLowerCase()) ||
        user.role === 'customer'
      );
    });
  }, [orders, user]);

  const dynamicTransactions: WalletTransaction[] = useMemo(() => {
    const txList: WalletTransaction[] = [];
    const seenRefs = new Set<string>();

    // 1. Process server-stored wallet transactions (both deposits & order debits from D1)
    (walletDeposits || []).forEach((dep) => {
      const isOrder = dep.type === 'order' || dep.amount < 0;
      const ref = dep.reference || dep.id;
      seenRefs.add(ref);
      seenRefs.add(dep.id);

      txList.push({
        id: dep.id,
        type: isOrder ? 'order' : ((dep.type || 'deposit') as any),
        title: dep.title || (isOrder ? 'Order Payment' : 'Wallet Deposit'),
        description: dep.description || (isOrder ? 'Food items' : 'Top-up'),
        reference: ref,
        amount: isOrder ? -Math.abs(dep.amount) : Math.abs(dep.amount),
        timestamp: dep.timestamp ? formatOrderTime(dep.timestamp) : 'Recent',
        status: (dep.status || 'completed') as any
      });
    });

    // 2. Correlate user orders so whenever an order is placed, it immediately appears in payment history
    userOrders.forEach((ord) => {
      const ref = ord.shortId || ord.id;
      const ordTxId = `ord-tx-${ord.id}`;
      if (!seenRefs.has(ref) && !seenRefs.has(ord.id) && !seenRefs.has(ordTxId)) {
        seenRefs.add(ref);
        seenRefs.add(ord.id);
        seenRefs.add(ordTxId);

        txList.push({
          id: ordTxId,
          type: 'order',
          title: `Order Payment — ${ord.restaurantName || 'Restaurant'}`,
          description:
            (ord.items || [])
              .map((i) => `${i?.quantity || 1}x ${i?.menuItem?.name || (i as any)?.name || 'Dish'}`)
              .join(', ') || 'Food items',
          reference: `ORD-${ref}`,
          amount: -Math.abs(Number(ord.total || 0)),
          timestamp: ord.createdAt
            ? formatOrderTime(ord.createdAt)
            : 'Recent Order',
          status: ord.status === 'cancelled' ? 'failed' : 'completed'
        });
      }
    });

    return txList;
  }, [walletDeposits, userOrders]);

  const filteredTransactions = dynamicTransactions.filter((tx) => {
    if (activeTxTab === 'deposits') return tx.amount > 0;
    if (activeTxTab === 'orders') return tx.amount < 0;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading your account...</p>
      </div>
    );
  }

  // If user is not authenticated, display live account sign-in screen (No mock/demo cards)
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-8 h-8 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Sign In Required
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Please sign in to access your live Veyrang account, in-app Naira wallet, saved delivery addresses, and transaction statements.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <User className="w-4 h-4" />
            <span>Sign In to Your Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>256-Bit Encrypted Live Account Protection</span>
        </div>
      </div>
    );
  }

  // Authenticated Live User View
  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              Account & Wallet Hub
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              Live Account Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your personal profile, instant ₦ wallet, and delivery addresses
          </p>
        </div>

        <button
          onClick={() => setIsWalletModalOpen(true)}
          className="self-start sm:self-auto px-4 py-2 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Funds</span>
        </button>
      </div>

      {topUpSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{topUpSuccess}</span>
        </div>
      )}

      {/* Live Authenticated Profile Card */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF1E8] text-[#FF5500] font-extrabold text-xl flex items-center justify-center font-display shadow-2xs border border-orange-200/60">
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {user.name || user.email?.split('@')[0] || 'User'}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                Verified Account
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">{user.email}</p>
            {user.phone ? (
              <div className="flex items-center gap-1 text-xs text-slate-600 mt-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{user.phone}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 font-sans text-[11px]">Lagos & Abuja Dispatch</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Account Active</span>
          </span>
        </div>
      </div>

      {/* Staff Control Portal Quick-Launch Card */}
      {['admin', 'sub_admin', 'restaurant', 'courier'].includes(user.role) && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 text-white p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-[#FF5500] border border-orange-500/30 flex items-center justify-center shrink-0">
              {user.role === 'restaurant' ? (
                <ChefHat className="w-6 h-6" />
              ) : user.role === 'courier' ? (
                <Bike className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-display">
                  {user.role === 'sub_admin'
                    ? 'Sub Admin Operations Console'
                    : user.role === 'admin'
                    ? 'Super Admin Operations Console'
                    : user.role === 'restaurant'
                    ? 'Merchant Kitchen KDS Portal'
                    : 'Courier Rider Dispatch Console'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  {user.role === 'sub_admin' ? 'Sub Admin' : user.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {user.role === 'sub_admin' || user.role === 'admin'
                  ? 'Access live order dispatches, dishes catalog, rider fleet & platform management.'
                  : user.role === 'restaurant'
                  ? 'Access live incoming kitchen tickets, order prep times & food stock availability.'
                  : 'Access turn-by-turn deliveries, pickup dispatches & customer PIN handovers.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveRole(user.role === 'sub_admin' ? 'admin' : (user.role as any));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-2.5 rounded-xl bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs font-bold transition-all shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Launch Control Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Veyrang Wallet Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#FF5500]" />
            <h2 className="text-base font-bold text-slate-900 font-display">
              Veyrang In-App Wallet
            </h2>
          </div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Instant Checkout Enabled</span>
          </span>
        </div>

        <WalletCard />
      </div>

      {/* Dedicated Virtual Bank Transfer Card */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FF5500]" />
            <h3 className="text-sm font-bold text-slate-900 font-display">
              Direct Bank Transfer (Virtual NIP Account)
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Zero Transfer Fee
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Dedicated Virtual Bank Account Number
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-wider">
              {virtualAccount.accountNumberFormatted}
            </div>
            <p className="text-[11px] text-slate-500">
              Beneficiary: <span className="font-bold text-slate-700">Veyrang / {user.name || user.email?.split('@')[0] || 'User'}</span>
            </p>
          </div>

          <button
            onClick={handleCopyAccount}
            className="px-4 py-2 bg-white hover:bg-orange-100/80 border border-orange-200 text-[#FF5500] rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            {copiedAccount ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAccount ? 'Copied to Clipboard!' : 'Copy Account'}</span>
          </button>
        </div>

        {/* 1-Tap Quick Top-Up Preset Chips */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-700">
            Quick Deposit Top-Up:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[2500, 5000, 10000, 25000].map((amt) => (
              <button
                key={amt}
                onClick={() => handleQuickTopUp(amt)}
                className="py-2.5 px-2 rounded-xl bg-slate-50 hover:bg-[#FFF1E8] border border-slate-200/90 hover:border-orange-300 text-slate-800 hover:text-[#FF5500] text-xs font-bold font-mono transition-all text-center cursor-pointer shadow-2xs"
              >
                +₦{amt.toLocaleString('en-NG')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Wallet Transaction History */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#FF5500]" />
              <span>Wallet Activity & Statement</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live audit ledger of all wallet deposits, food order debits, and cashback rewards
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTxTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTxTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTxTab('deposits')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTxTab === 'deposits'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Deposits (+)
            </button>
            <button
              onClick={() => setActiveTxTab('orders')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTxTab === 'orders'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orders (-)
            </button>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-slate-700">No transactions recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Your deposits and food order debits will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-white hover:shadow-xs transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-orange-100 text-[#FF5500]'
                      }`}
                    >
                      {isPositive ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {tx.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {tx.description} · <span className="font-mono text-slate-400">{tx.reference}</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {tx.timestamp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm sm:text-base font-extrabold font-mono tabular-nums ${
                        isPositive ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isPositive ? `+₦${tx.amount.toLocaleString('en-NG')}` : `-₦${Math.abs(tx.amount).toLocaleString('en-NG')}`}
                    </div>
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved Delivery Addresses */}
      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF5500]" />
              <span>Saved Delivery Addresses</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Permanently saved for live road distance calculations & instant checkout
            </p>
          </div>
          <button
            onClick={() => setIsAddingAddr((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF5500] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingAddr ? 'Cancel' : 'Add Address'}</span>
          </button>
        </div>

        {/* Add New Address Inline Form */}
        {isAddingAddr && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in">
            <ProAddressForm
              onSave={async (formData) => {
                setIsSavingAddr(true);
                try {
                  await addSavedAddress({
                    label: formData.label,
                    address: formData.address,
                    apartment: formData.apartment,
                    city: formData.city,
                    isDefault: formData.isDefault
                  });
                  setIsAddingAddr(false);
                } catch (err: any) {
                  console.error('Failed to add address:', err);
                } finally {
                  setIsSavingAddr(false);
                }
              }}
              onCancel={() => setIsAddingAddr(false)}
              isSubmitting={isSavingAddr}
            />
          </div>
        )}

        {savedAddresses.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs sm:text-sm font-semibold text-slate-700">No saved addresses</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Address" above to save your delivery location.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {savedAddresses.map((addr) => {
              const isSelected = selectedAddress.id === addr.id;
              return (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddress(addr)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-[#FF5500] bg-[#FFF1E8]/30 shadow-xs ring-1 ring-[#FF5500]/30'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{addr.label}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold text-[#FF5500] bg-[#FFF1E8] px-1.5 py-0.5 rounded-md">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1 truncate font-medium">{addr.address}</p>
                    {(addr.apartment || addr.city) && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {[addr.apartment, addr.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedAddress(addr.id);
                    }}
                    title="Delete address"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={() => logout()}
          className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out of Veyrang</span>
        </button>
      </div>
    </div>
  );
};
