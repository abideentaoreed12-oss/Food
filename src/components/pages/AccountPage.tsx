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
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrText, setAddrText] = useState('');
  const [addrApt, setAddrApt] = useState('');
  const [addrCity, setAddrCity] = useState('Lagos');
  const [isSavingAddr, setIsSavingAddr] = useState(false);

  const handleQuickTopUp = (_amount: number) => {
    setIsWalletModalOpen(true);
  };

  const virtualAccount = getUserVirtualAccount(user);

  const handleCopyAccount = () => {
    if (!virtualAccount?.accountNumberRaw) return;
    navigator.clipboard?.writeText(virtualAccount.accountNumberRaw);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

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
          timestamp: ord.createdAt ? formatOrderTime(ord.createdAt) : 'Recent Order',
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

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 stroke-[2]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">Sign In Required</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Please sign in to access your live Veyrang account, wallet, and addresses.
          </p>
        </div>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="w-full py-3.5 bg-[#FF5500] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
        >
          <User className="w-4 h-4" />
          Sign In to Your Account
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Account &amp; Wallet Hub</h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              Live Account Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage profile, wallet, and delivery addresses</p>
        </div>
        <button
          onClick={() => setIsWalletModalOpen(true)}
          className="self-start sm:self-auto px-4 py-2 bg-[#FF5500] text-white rounded-2xl text-xs font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Funds
        </button>
      </div>

      {topUpSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{topUpSuccess}</span>
        </div>
      )}

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF1E8] text-[#FF5500] font-extrabold text-xl flex items-center justify-center">
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{user.name || user.email?.split('@')[0] || 'User'}</h2>
            <p className="text-xs text-slate-500 font-mono">{user.email}</p>
            {user.phone ? (
              <div className="flex items-center gap-1 text-xs text-slate-600 mt-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{user.phone}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {['admin', 'sub_admin', 'restaurant', 'courier'].includes(user.role) && (
        <div className="rounded-3xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-[#FF5500] flex items-center justify-center">
              {user.role === 'restaurant' ? <ChefHat className="w-6 h-6" /> : user.role === 'courier' ? <Bike className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Staff Control Portal</h3>
              <p className="text-xs text-slate-400">Role: {user.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveRole(user.role === 'sub_admin' ? 'admin' : (user.role as any));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-2.5 rounded-xl bg-[#FF5500] text-white text-xs font-bold flex items-center gap-1.5"
          >
            Launch Control Portal
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Wallet className="w-4 h-4 text-[#FF5500]" />
          <h2 className="text-base font-bold text-slate-900">Veyrang In-App Wallet</h2>
        </div>
        <WalletCard />
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FF5500]" />
            <h3 className="text-sm font-bold text-slate-900">Direct Bank Transfer (Virtual Account)</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-orange-50/50 border border-orange-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Dedicated Virtual Bank Account Number
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-wider">
              {virtualAccount?.accountNumberFormatted || 'Not generated yet'}
            </div>
            <p className="text-[11px] text-slate-500">
              {virtualAccount ? (
                <>
                  Bank: <span className="font-bold text-slate-700">{virtualAccount.bankName}</span>
                  {' · '}
                  Beneficiary: <span className="font-bold text-slate-700">{virtualAccount.accountName}</span>
                </>
              ) : (
                <span>Open <strong>Add Funds</strong> to generate a live Paystack virtual account.</span>
              )}
            </p>
          </div>
          <button
            onClick={handleCopyAccount}
            disabled={!virtualAccount}
            className="px-4 py-2 bg-white border border-orange-200 text-[#FF5500] rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copiedAccount ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAccount ? 'Copied!' : virtualAccount ? 'Copy Account' : 'No Account'}</span>
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-700">Quick Deposit Top-Up:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[2500, 5000, 10000, 25000].map((amt) => (
              <button
                key={amt}
                onClick={() => handleQuickTopUp(amt)}
                className="py-2.5 px-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold font-mono"
              >
                +₦{amt.toLocaleString('en-NG')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#FF5500]" />
          <h3 className="text-base font-bold text-slate-900">Wallet Activity</h3>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
          {(['all', 'deposits', 'orders'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTxTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-bold ${
                activeTxTab === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'deposits' ? 'Deposits (+)' : 'Orders (-)'}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No wallet activity yet.</p>
          ) : (
            filteredTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  {tx.amount > 0 ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-900">{tx.title}</p>
                    <p className="text-[11px] text-slate-500">{tx.timestamp}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold font-mono ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {tx.amount > 0 ? '+' : ''}₦{Math.abs(tx.amount).toLocaleString('en-NG')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/90 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#FF5500]" />
            <h3 className="text-sm font-bold text-slate-900">Saved Addresses</h3>
          </div>
          <button
            onClick={() => setIsAddingAddr(true)}
            className="text-xs font-bold text-[#FF5500] flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {isAddingAddr && (
          <div className="p-3 border border-slate-200 rounded-xl space-y-2">
            <input
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
              placeholder="Label (Home, Work)"
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
            <input
              value={addrText}
              onChange={(e) => setAddrText(e.target.value)}
              placeholder="Full address"
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
            <div className="flex gap-2">
              <button
                disabled={isSavingAddr || !addrText.trim()}
                onClick={async () => {
                  setIsSavingAddr(true);
                  try {
                    await addSavedAddress({
                      label: addrLabel,
                      address: addrText,
                      apartment: addrApt,
                      city: addrCity
                    });
                    setIsAddingAddr(false);
                    setAddrText('');
                  } finally {
                    setIsSavingAddr(false);
                  }
                }}
                className="px-3 py-2 bg-[#FF5500] text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setIsAddingAddr(false)} className="px-3 py-2 text-xs border rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}
        {(savedAddresses || []).length === 0 && !isAddingAddr ? (
          <p className="text-xs text-slate-500">No saved addresses yet.</p>
        ) : (
          (savedAddresses || []).map((addr: any) => (
            <div key={addr.id || addr.address} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
              <div>
                <p className="text-xs font-bold">{addr.label || 'Address'}</p>
                <p className="text-[11px] text-slate-500">{addr.address}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedAddress(addr)}
                  className="text-[11px] font-bold text-[#FF5500]"
                >
                  Use
                </button>
                <button
                  onClick={() => deleteSavedAddress(addr.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => logout()}
        className="w-full py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
};
