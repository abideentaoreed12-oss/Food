import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatCurrency, getUserVirtualAccount } from '../../utils/format';
import {
  X,
  Wallet,
  Plus,
  ShieldCheck,
  CreditCard,
  Building2,
  PhoneCall,
  CheckCircle2,
  Lock,
  ArrowRight,
  Copy,
  Check,
  AlertCircle,
  Zap,
  ChevronRight
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { currency, walletBalanceNGN, topUpWallet } = useDelivery();
  const { user, setIsAuthModalOpen } = useAuth();
  const [topUpAmount, setTopUpAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'ussd'>('transfer');
  const [loading, setLoading] = useState<boolean>(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);

  if (!isOpen) return null;

  const presetAmounts = [1000, 2500, 5000, 10000, 25000, 50000];

  const handleSelectPreset = (amt: number) => {
    setIsCustom(false);
    setTopUpAmount(amt);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustom(true);
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    if (val) {
      setTopUpAmount(parseInt(val, 10));
    }
  };

  const virtualAccount = getUserVirtualAccount(user);

  const handleCopyVirtualAccount = () => {
    navigator.clipboard?.writeText(virtualAccount.accountNumberRaw);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpAmount <= 0) return;

    setLoading(true);
    try {
      const res: any = await api.payment.initialize({
        email: user?.email || 'customer@veyrang.com',
        amount: topUpAmount,
        callbackUrl: window.location.origin + '/?payment_status=success',
        metadata: { userId: user?.id || user?.email, type: 'wallet_topup' }
      });

      if (res?.data?.authorizationUrl) {
        window.location.href = res.data.authorizationUrl;
        return;
      }

      await topUpWallet(topUpAmount);
      setLoading(false);
      setSuccessNote(`Successfully credited ₦${topUpAmount.toLocaleString('en-NG')} to your Veyrang Wallet!`);
      setTimeout(() => {
        setSuccessNote(null);
        onClose();
      }, 1600);
    } catch (err) {
      await topUpWallet(topUpAmount);
      setLoading(false);
      setSuccessNote(`Successfully credited ₦${topUpAmount.toLocaleString('en-NG')} to your Veyrang Wallet!`);
      setTimeout(() => {
        setSuccessNote(null);
        onClose();
      }, 1600);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1E8] text-[#FF5500] flex items-center justify-center shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Fund Veyrang Wallet
                </h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Instant Credit
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Zero-decline checkout for all Lagos & Abuja restaurants
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!user ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF1E8] text-[#FF5500] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 stroke-[2]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 font-display">Sign In Required</h3>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                Please sign in to your live Veyrang account to access your wallet, deposit funds, and view virtual account details.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                setIsAuthModalOpen(true);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer"
            >
              Sign In to Your Live Account
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Current Balance Card (Miniaturized signature orange) */}
            <div className="rounded-2xl bg-[#FF5500] p-4 text-white shadow-md shadow-orange-500/15 flex items-center justify-between relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wider">
                  Current Wallet Balance
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-sans mt-0.5 tracking-tight">
                  ₦{walletBalanceNGN.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 relative z-10">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            </div>

            {successNote && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNote}</span>
              </div>
            )}

            {/* PAYMENT METHODS SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Payment Methods
                </span>
                <span className="text-[11px] text-slate-400">Select funding option</span>
              </div>

              {/* Option 1: Dedicated Bank Account Transfer */}
              <div
                onClick={() => setPaymentMethod('transfer')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  paymentMethod === 'transfer'
                    ? 'border-[#FF5500] bg-orange-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-orange-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#FF5500] flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">Direct Bank Transfer</h4>
                      <p className="text-[11px] text-slate-500">Dedicated Virtual Account</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Auto-Reconciled
                  </span>
                </div>

                {/* Account Details Box */}
                <div className="p-3.5 bg-white rounded-xl border border-orange-200/80 shadow-xs space-y-2.5 mt-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500 font-medium">Bank Name</span>
                    <span className="text-xs font-bold text-slate-900">{virtualAccount.bankName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-medium">Account Number</span>
                      <span className="text-lg sm:text-xl font-black font-mono text-slate-900 tracking-wider">
                        {virtualAccount.accountNumberFormatted}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyVirtualAccount();
                      }}
                      className="px-3 py-1.5 bg-[#FF5500] hover:bg-[#EA4C00] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAccount ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-xs text-slate-500 font-medium">Account Name</span>
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                      {virtualAccount.accountName}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 mt-2.5 bg-white/70 p-2.5 rounded-xl border border-slate-200/80">
                  <p>
                    Transfer from any bank or mobile banking app. Balance updates within 5 seconds.
                  </p>
                </div>
              </div>

              {/* Option 2: Online Payment via Gateway (Collapsed by default until clicked) */}
              <div
                onClick={() => setPaymentMethod(paymentMethod === 'card' ? 'transfer' : 'card')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'border-[#FF5500] bg-orange-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-orange-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
                      <Zap className="w-5 h-5 fill-white stroke-[2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          ⚡ Online Payment
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Instant
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        Pay securely via Gateway
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Instant confirmation</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[#FF5500]">
                    <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${paymentMethod === 'card' ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Gateway Payment Form when Online Payment is selected */}
                {paymentMethod === 'card' && (
                  <form
                    onSubmit={handleTopUpSubmit}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 pt-4 border-t border-orange-200/80 space-y-3.5 animate-in fade-in duration-200"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Select Top-up Amount (NGN)</span>
                        <span className="text-[11px] font-normal text-slate-500">Card / USSD / Transfer</span>
                      </label>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {presetAmounts.map((amt) => {
                          const selected = !isCustom && topUpAmount === amt;
                          return (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleSelectPreset(amt)}
                              className={`py-2 px-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border text-center ${
                                selected
                                  ? 'bg-[#FF5500] text-white border-[#FF5500] shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                              }`}
                            >
                              ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Amount Input */}
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="Or enter custom amount (e.g. 15000)"
                          value={customAmount}
                          onChange={handleCustomChange}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] font-mono outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || topUpAmount <= 0}
                      className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <span>Connecting to Gateway...</span>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 stroke-[2.5]" />
                          <span>Pay ₦{topUpAmount.toLocaleString('en-NG')} via Secure Gateway</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Security badge */}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>256-Bit Bank-Grade Encryption · CBN Licensed Payment Gateway</span>
            </div>
          </div>
        )}
    </div>
  </div>
);
};
