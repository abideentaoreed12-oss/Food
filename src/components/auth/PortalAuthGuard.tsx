'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useDelivery } from '../../context/DeliveryContext';
import { UserRole } from '../../types';
import { ROUTES } from '../../routes';
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
  const { user, loading, openAuthModalForPortal, canAccessRole } = useAuth();
  const { setActiveRole, setActivePage } = useDelivery();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#0D4F3C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          desc: 'Manage live incoming ticket orders, prep times, kitchen status toggles, and food catalog inventory across all active delivery zones.',
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
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 bg-[#F8F9FA]">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#E8F5EF] text-[#0D4F3C] flex items-center justify-center mx-auto shadow-inner">
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider">
            {portal.badge}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {portal.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            {portal.desc}
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={() => openAuthModalForPortal(requiredRole)}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#0D4F3C] hover:bg-[#0A3F30] text-white text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <KeyRound className="w-4 h-4 text-[#E8C547]" />
            <span>Sign In to Access Portal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            href={ROUTES.HOME}
            onClick={() => {
              setActiveRole('customer');
              setActivePage('home');
            }}
            className="w-full py-3 px-5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Storefront</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
