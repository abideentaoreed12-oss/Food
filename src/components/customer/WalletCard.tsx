import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { Eye, EyeOff, Plus, ChevronRight, Wallet } from 'lucide-react';

interface WalletCardProps {
  className?: string;
}

export const WalletCard: React.FC<WalletCardProps> = ({ className = '' }) => {
  const { walletBalanceNGN, setIsWalletModalOpen } = useDelivery();
  const [showBalance, setShowBalance] = useState<boolean>(true);

  return (
    <div
      className={`rounded-3xl bg-[#0D4F3C] text-white p-5 sm:p-6 shadow-md shadow-emerald-900/20 select-none relative overflow-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ background: 'radial-gradient(ellipse at 90% 10%, #E8C547 0%, transparent 55%)' }}
      />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[#E8C547]" />
          </span>
          <span className="text-sm sm:text-base font-bold text-white tracking-tight">
            Wallet balance
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowBalance(!showBalance);
            }}
            className="p-1 text-white/90 hover:text-white rounded-full hover:bg-white/15 transition-colors cursor-pointer"
            aria-label={showBalance ? 'Hide wallet balance' : 'Show wallet balance'}
            title={showBalance ? 'Hide balance' : 'Show balance'}
          >
            {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsWalletModalOpen(true)}
          className="rounded-full bg-[#E8C547] text-[#0D4F3C] hover:bg-[#D4B23A] active:scale-95 text-xs sm:text-sm font-extrabold px-4 py-1.5 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Fund Wallet</span>
        </button>
      </div>

      <div className="relative py-2.5 sm:py-3">
        <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white font-sans tracking-tight">
          {showBalance ? (
            <>
              <span className="font-sans mr-0.5">₦</span>
              <span className="font-mono tabular-nums">
                {(Number(walletBalanceNGN) || 0).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </>
          ) : (
            <span className="font-mono tracking-widest text-2xl sm:text-3xl">₦••••••••</span>
          )}
        </div>
      </div>

      <div className="relative border-t border-white/20 my-1" />

      <div
        onClick={() => setIsWalletModalOpen(true)}
        className="relative pt-2 flex items-center justify-between text-xs sm:text-sm text-white/95 cursor-pointer group"
      >
        <span className="font-medium text-[11px] sm:text-xs">
          Tap up your wallet for faster checkout
        </span>
        <span className="font-bold flex items-center gap-0.5 text-[#E8C547] group-hover:underline text-[11px] sm:text-xs shrink-0">
          <span>Add Funds</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      </div>
    </div>
  );
};
