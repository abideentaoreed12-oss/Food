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

  // Auto-redirect to customer landing view if not authorized
  React.useEffect(() => {
    setActiveRole('customer');
    setActivePage('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setActiveRole, setActivePage]);

  return null;
};
