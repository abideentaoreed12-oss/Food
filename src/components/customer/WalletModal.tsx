import React, { useState, useEffect } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getUserVirtualAccount } from '../../utils/format';
import {
  X, Wallet, ShieldCheck, CreditCard, Building2, CheckCircle2, Lock,
  Copy, Check, Zap, ChevronRight, AlertCircle
} from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { walletBalanceNGN } = useDelivery();
  const { user, setIsAuthModalOpen } = useAuth();
  const [topUpAmount, setTopUpAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('transfer');
  const [loading, setLoading] = useState<boolean>(false);
  const [vaLoading, setVaLoading] = useState<boolean>(false);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [liveVa, setLiveVa] = useState<{
    accountNumberFormatted: string;
    accountNumberRaw: string;
    bankName: string;
    accountName: string;
  } | null>(null);

  const presetAmounts = [1000, 2500, 5000, 10000, 25000, 50000];

  useEffect(() => {
    if (!isOpen || !user) return;
    const fromUser = getUserVirtualAccount(user);
    if (fromUser) {
      setLiveVa(fromUser);
      return;
    }
    // Try fetch existing from API
    (async () => {
      try {
        const data: any = await api.payment.getVirtualAccount?.();
        if (data?.accountNumber) {
          const raw = String(data.accountNumber).replace(/[^0-9]/g, '');
          setLiveVa({
            accountNumberRaw: raw,
            accountNumberFormatted:
              raw.length === 10 ? `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7, 10)}` : raw,
            bankName: data.bankName,
            accountName: data.accountName
          });
        }
      } catch {
        /* none yet */
      }
    })();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSelectPreset = (amt: number) => {
    setIsCustom(false);
    setTopUpAmount(amt);
    setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustom(true);
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    if (val) setTopUpAmount(parseInt(val, 10));
  };

  const handleCopyVirtualAccount = () => {
    if (!liveVa) return;
    navigator.clipboard?.writeText(liveVa.accountNumberRaw);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleGenerateVa = async () => {
    setVaLoading(true);
    setErrorNote(null);
    try {
      const res: any = await fetch('/api/payment/virtual-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('veyrang_jwt_token') || ''}`
        },
        credentials: 'include'
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not create virtual account');
      }
      const raw = String(json.data.accountNumber).replace(/[^0-9]/g, '');
      setLiveVa({
        accountNumberRaw: raw,
        accountNumberFormatted:
          raw.length === 10 ? `${raw.slice(0, 4)} ${raw.slice(4, 7)} ${raw.slice(7, 10)}` : raw,
        bankName: json.data.bankName,
        accountName: json.data.accountName
      });
    } catch (err: any) {
      setErrorNote(err.message || 'Virtual account unavailable. Use Online Payment instead.');
    } finally {
      setVaLoading(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpAmount <= 0) return;
    setLoading(true);
    setErrorNote(null);
    setSuccessNote(null);
    try {
      const res: any = await api.payment.initialize({
        email: user?.email || '',
        amount: topUpAmount,
        callbackUrl: window.location.origin + '/payment/callback',
        metadata: { userId: user?.id, type: 'wallet_topup' }
      });

      const url = res?.authorizationUrl || res?.data?.authorizationUrl;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error('Paystack did not return a checkout URL');
    } catch (err: any) {
      // Never credit wallet locally on failure
      setErrorNote(err.message || 'Payment could not start. Try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF1E8] text-[#FF5500] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Fund Veyrang Wallet</h3>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Live</span>
              </div>
              <p className="text-xs text-slate-500">Paystack virtual account & gateway</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user ? (
          <div className="p-6 text-center space-y-4">
            <Lock className="w-6 h-6 mx-auto text-[#FF5500]" />
            <p className="text-xs text-slate-600">Sign in to fund your wallet.</p>
            <button
              onClick={() => { onClose(); setIsAuthModalOpen(true); }}
              className="w-full py-3.5 bg-[#FF5500] text-white rounded-2xl text-xs font-bold"
            >
              Sign In
            </button>
          </div>
        ) : (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            <div className="rounded-2xl bg-[#FF5500] p-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-white/90 uppercase">Current Wallet Balance</span>
                <div className="text-2xl font-extrabold mt-0.5">
                  ₦{walletBalanceNGN.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <ShieldCheck className="w-5 h-5" />
            </div>

            {errorNote && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorNote}</span>
              </div>
            )}
            {successNote && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successNote}</span>
              </div>
            )}

            {/* Bank transfer — live VA only */}
            <div
              onClick={() => setPaymentMethod('transfer')}
              className={`p-4 rounded-2xl border-2 cursor-pointer ${
                paymentMethod === 'transfer' ? 'border-[#FF5500] bg-orange-50/40' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-[#FF5500]" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">Direct Bank Transfer</h4>
                    <p className="text-[11px] text-slate-500">Paystack Dedicated Virtual Account</p>
                  </div>
                </div>
              </div>

              {liveVa ? (
                <div className="p-3.5 bg-white rounded-xl border border-orange-200/80 space-y-2.5 mt-2">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs text-slate-500">Bank Name</span>
                    <span className="text-xs font-bold text-slate-900">{liveVa.bankName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-slate-500">Account Number</span>
                      <span className="text-lg font-black font-mono tracking-wider">{liveVa.accountNumberFormatted}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopyVirtualAccount(); }}
                      className="px-3 py-1.5 bg-[#FF5500] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedAccount ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-xs text-slate-500">Account Name</span>
                    <span className="text-xs font-bold truncate max-w-[200px]">{liveVa.accountName}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                  <p className="text-xs text-slate-600">No virtual account on file yet.</p>
                  <button
                    type="button"
                    disabled={vaLoading}
                    onClick={(e) => { e.stopPropagation(); handleGenerateVa(); }}
                    className="w-full py-2.5 bg-[#FF5500] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {vaLoading ? 'Creating with Paystack…' : 'Generate Paystack Virtual Account'}
                  </button>
                </div>
              )}
            </div>

            {/* Online gateway */}
            <div
              onClick={() => setPaymentMethod('card')}
              className={`p-4 rounded-2xl border-2 cursor-pointer ${
                paymentMethod === 'card' ? 'border-[#FF5500] bg-orange-50/40' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF5500] text-white flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold">Online Payment</h4>
                    <p className="text-xs text-slate-600">Official Paystack checkout</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 text-[#FF5500] ${paymentMethod === 'card' ? 'rotate-90' : ''}`} />
              </div>

              {paymentMethod === 'card' && (
                <form onSubmit={handleTopUpSubmit} onClick={(e) => e.stopPropagation()} className="mt-4 pt-4 border-t border-orange-200 space-y-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {presetAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSelectPreset(amt)}
                        className={`py-2 rounded-xl text-xs font-bold border ${
                          !isCustom && topUpAmount === amt
                            ? 'bg-[#FF5500] text-white border-[#FF5500]'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={handleCustomChange}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 font-mono outline-none focus:border-[#FF5500]"
                  />
                  <button
                    type="submit"
                    disabled={loading || topUpAmount <= 0}
                    className="w-full py-3.5 bg-[#FF5500] text-white rounded-2xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    {loading ? 'Opening Paystack…' : `Pay ₦${topUpAmount.toLocaleString('en-NG')} via Paystack`}
                  </button>
                </form>
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Credits only after verified Paystack payment</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
