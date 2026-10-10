import React, { useState, useEffect } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Tag, Copy, Check, Percent, ShoppingBag, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

export const OffersPage: React.FC = () => {
  const { applyPromoCode, setIsCartOpen, cart, platformSettings } = useDelivery();
  const { user, setIsAuthModalOpen } = useAuth();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [dynamicPromos, setDynamicPromos] = useState<any[]>([]);

  useEffect(() => {
    api.settings.getPromos().then((res: any) => {
      const list = res?.data || res || [];
      if (Array.isArray(list)) {
        const mapped = list.map((p: any, idx: number) => {
          const colors = [
            'from-orange-500 to-amber-500',
            'from-emerald-500 to-teal-500',
            'from-blue-500 to-indigo-500',
            'from-purple-500 to-pink-500'
          ];
          return {
            code: p.code,
            title: p.discount_type === 'percentage'
              ? `${p.value}% Off Your Order`
              : `₦${Number(p.value).toLocaleString('en-NG')} Off Instant Savings`,
            description: p.discount_type === 'percentage'
              ? `Enjoy ${p.value}% discount up to ₦${Number(p.max_discount_cap || 2500).toLocaleString('en-NG')} on orders above ₦${Number(p.min_order_amount || 0).toLocaleString('en-NG')}.`
              : `Take ₦${Number(p.value).toLocaleString('en-NG')} flat discount on orders over ₦${Number(p.min_order_amount || 0).toLocaleString('en-NG')}.`,
            minOrder: `₦${Number(p.min_order_amount || 0).toLocaleString('en-NG')}`,
            badge: idx === 0 ? 'Featured Offer' : 'Active Promo',
            color: colors[idx % colors.length]
          };
        });
        setDynamicPromos(mapped);
      } else {
        setDynamicPromos([]);
      }
    }).catch(() => {
      setDynamicPromos([]);
    });
  }, []);

  const promos = dynamicPromos;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleApplyToCart = async (code: string) => {
    const res = await applyPromoCode(code);
    setApplyMessage(res.message);
    setIsCartOpen(true);
    setTimeout(() => setApplyMessage(null), 3500);
  };

  return (
    <div className="max-w-xl sm:max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto space-y-6 pb-20">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
            {platformSettings?.cms_offers_title || 'Offers & Promo Codes'}
          </h1>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Active Deals
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {platformSettings?.cms_offers_subtitle || 'Apply any of these verified promo codes at checkout for instant savings'}
        </p>
      </div>

      {!user && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5500] text-white flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                {platformSettings?.cms_offers_member_title || 'Sign in to unlock exclusive member cashback'}
              </div>
              <div className="text-[11px] text-slate-500">
                {platformSettings?.cms_offers_member_desc || 'Sign in to manage your account and view offers available to you.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="py-2 px-4 rounded-xl bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            Sign In / Register
          </button>
        </div>
      )}

      {applyMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-in fade-in">
          {applyMessage}
        </div>
      )}

      {promos.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 bg-white shadow-2xs">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No active promotions</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Check back soon for fresh discount coupons, seasonal feasts, and exclusive member cashback!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map((p) => {
            const isCopied = copiedCode === p.code;

          return (
            <div
              key={p.code}
              className="rounded-3xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700">
                    {p.badge}
                  </span>
                  <span className="text-[11px] text-slate-400">Min. spend {p.minOrder}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{p.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{p.description}</p>
              </div>

              {/* Code Box & Actions */}
              <div className="w-full sm:w-auto flex sm:flex-col items-center gap-2 shrink-0">
                <div className="flex-1 sm:flex-initial flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                  <span className="font-mono font-bold text-sm text-slate-900 tracking-wider">
                    {p.code}
                  </span>
                  <button
                    onClick={() => handleCopy(p.code)}
                    aria-label={`Copy promo code ${p.code}`}
                    className="p-1 rounded-md text-slate-500 hover:text-orange-600 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <button
                  onClick={() => handleApplyToCart(p.code)}
                  className="px-3.5 py-2 rounded-xl bg-[#FF5500] text-white text-xs font-bold hover:bg-[#EA4C00] transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  Apply Code
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
    </div>
  );
};
