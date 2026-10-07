import React, { useState } from 'react';
import { useDelivery } from '../../context/DeliveryContext';
import { Eye, EyeOff, Plus, ChevronRight } from 'lucide-react';

interface WalletCardProps {
  className?: string;
}

export const WalletCard: React.FC<WalletCardProps> = ({ className = '' }) => {
  const { walletBalanceNGN, setIsWalletModalOpen } = useDelivery();
  const [showBalance, setShowBalance] = useState<boolean>(true);

  return (
    <div
      className={`rounded-3xl bg-[#FF5500] text-white p-5 sm:p-6 shadow-md shadow-orange-500/20 select-none relative overflow-hidden ${className}`}
    >
      {/* Top Row: Title + Eye toggle and "+ Fund Wallet" button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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

        {/* "+ Fund Wallet" Button matching exact pill style */}
        <button
          type="button"
          onClick={() => setIsWalletModalOpen(true)}
          className="rounded-full bg-white text-[#FF5500] hover:bg-orange-50 active:scale-95 text-xs sm:text-sm font-extrabold px-4 py-1.5 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Fund Wallet</span>
        </button>
      </div>

      {/* Middle Amount: ₦28,278.70 (Matching exact bold large text in IMG_5190.jpeg) */}
      <div className="py-2.5 sm:py-3">
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

      {/* Thin Horizontal Divider */}
      <div className="border-t border-white/25 my-1" />

      {/* Bottom Row: Helper text & "Add Funds >" trigger */}
      <div
        onClick={() => setIsWalletModalOpen(true)}
        className="pt-2 flex items-center justify-between text-xs sm:text-sm text-white/95 cursor-pointer group"
      >
        <span className="font-medium text-[11px] sm:text-xs">
          Top up your wallet for faster checkout
        </span>
        <span className="font-bold flex items-center gap-0.5 text-white group-hover:underline text-[11px] sm:text-xs shrink-0">
          <span>Add Funds</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      </div>
    </div>
  );
};
