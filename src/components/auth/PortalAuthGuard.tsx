import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDelivery } from '../../context/DeliveryContext';
import { UserRole } from '../../types';
import {
  Lock,
  ShieldCheck,
  ChefHat,
  Bike,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

interface PortalAuthGuardProps {
  requiredRole: UserRole;
  children: React.ReactNode;
}

export const PortalAuthGuard: React.FC<PortalAuthGuardProps> = ({ requiredRole, children }) => {
  const { user, openAuthModalForPortal, login, canAccessRole } = useAuth();
  const { setActiveRole, setActivePage } = useDelivery();

  const isAuthorized = user && canAccessRole(requiredRole);

  if (isAuthorized) {
    return <>{children}</>;
  }

  const getPortalInfo = () => {
    switch (requiredRole) {
      case 'restaurant':
        return {
          title: 'Merchant Kitchen KDS Portal',
          badge: 'Restricted to Restaurant Partners',
          desc: 'Manage live incoming ticket orders, prep times, kitchen status toggles, and food catalog inventory across Lagos & Abuja.',
          icon: ChefHat
        };
      case 'courier':
        return {
          title: 'Courier Rider Dispatch Console',
          badge: 'Restricted to Certified Riders',
          desc: 'Access turn-by-turn routing, pickup dispatch confirmations, and 4-digit security PIN customer handover verification.',
          icon: Bike
        };
      case 'admin':
        return {
          title: 'Admin Operations Control Center',
          badge: 'Restricted to Platform Operations',
          desc: 'Platform-wide order dispute resolution, delivery zone fee configurations, merchant commission tracking, and system audit logs.',
          icon: ShieldAlert
        };
      default:
        return {
          title: 'Private Management Portal',
          badge: 'Authentication Required',
          desc: 'You must be signed in with authorized credentials to view this dashboard.',
          icon: Lock
        };
    }
  };

  const portal = getPortalInfo();
  const Icon = portal.icon;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="rounded-3xl bg-slate-900 border border-slate-800 text-white p-6 sm:p-10 shadow-2xl space-y-6">
        {/* Header with Lock Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-600/20 text-[#FF5500] border border-orange-500/30 flex items-center justify-center shrink-0">
            <Icon className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>{portal.badge}</span>
          </span>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold font-display text-white">
            {portal.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {portal.desc}
          </p>
        </div>

        {/* Security Notice Box */}
        <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-orange-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Strict Access Control Policy</span>
          </div>
          <p className="text-slate-300 text-[11px]">
            {user
              ? `You are currently signed in as "${user.name}" with the "${user.role === 'sub_admin' ? 'Sub Admin' : user.role}" role. To access this dashboard, you need authorized staff credentials for "${requiredRole}".`
              : 'Please authenticate with your staff or partner credentials to access this dashboard.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-3">
          <button
            onClick={() => openAuthModalForPortal(requiredRole)}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#FF5500] hover:bg-[#EA4C00] text-white text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Sign In to {(portal.title || 'Portal').split(' ')[0]} Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              onClick={() => {
                setActiveRole('customer');
                setActivePage('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="py-2.5 px-3.5 rounded-xl bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Storefront</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
