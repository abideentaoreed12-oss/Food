import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDelivery } from '../../context/DeliveryContext';
import { RefreshCw, CheckCircle } from 'lucide-react';

export const SpecialActionButton: React.FC = () => {
  const { user } = useAuth();
  const { refreshData } = useDelivery();
  const [isSyncing, setIsSyncing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await refreshData();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('D1 sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user || (user.role !== 'restaurant' && user.role !== 'courier')) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="fixed bottom-6 right-6 px-4 py-3 bg-slate-900 border border-slate-700 hover:border-orange-500 text-white rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer z-50 select-none group"
      >
        <RefreshCw className={`w-4 h-4 text-orange-500 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        <span>{isSyncing ? 'Syncing D1 Database...' : 'Force Live Sync'}</span>
      </button>

      {showToast && (
        <div className="fixed bottom-20 right-6 px-4 py-2.5 bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Real-time D1 Sync Completed!</span>
        </div>
      )}
    </>
  );
};
