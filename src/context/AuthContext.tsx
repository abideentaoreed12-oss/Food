import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserRole, ActivePage } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  address?: string;
  restaurantId?: string;
  walletBalanceUSD?: number;
  walletBalanceNGN?: number;
  savedAddresses?: Array<{
    id: string;
    label: string;
    address: string;
    apartment?: string;
    city?: string;
    isDefault?: boolean;
  }>;
}

export const PUBLIC_PAGES: ActivePage[] = [
  'landing',
  'home',
  'restaurants',
  'search',
  'offers',
  'help',
  'partner',
  'terms',
  'privacy',
  'contact'
];

export const PRIVATE_CUSTOMER_PAGES: ActivePage[] = [
  'orders',
  'account',
  'favourites'
];

export const RESTRICTED_ROLES: UserRole[] = [
  'restaurant',
  'courier',
  'admin'
];

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: AuthUser; error?: string }>;
  register: (payload: { email: string; password: string; name: string; role?: UserRole; phone?: string; address?: string; code: string }) => Promise<{ success: boolean; pendingApproval?: boolean; message?: string; error?: string }>;
  sendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  intendedPortal: UserRole | null;
  setIntendedPortal: (role: UserRole | null) => void;
  openAuthModalForPortal: (role: UserRole) => void;
  canAccessRole: (role: UserRole) => boolean;
  isPublicPage: (page: ActivePage) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sanitizeUser(rawUser: any): AuthUser | null {
  if (!rawUser) return null;
  const actualUser = rawUser.user && typeof rawUser.user === 'object' && !Array.isArray(rawUser.user) ? rawUser.user : rawUser;
  if (!actualUser || typeof actualUser !== 'object' || !actualUser.email) return null;
  return {
    ...actualUser,
    id: actualUser.id || actualUser._id || 'usr-default',
    email: actualUser.email,
    role: (actualUser.role as UserRole) || 'customer',
    name: actualUser.name || (actualUser.email ? actualUser.email.split('@')[0] : 'User'),
    walletBalanceUSD: typeof actualUser.walletBalanceUSD === 'number' ? actualUser.walletBalanceUSD : 0,
    walletBalanceNGN: typeof actualUser.walletBalanceNGN === 'number' ? actualUser.walletBalanceNGN : 0,
    savedAddresses: Array.isArray(actualUser.savedAddresses) ? actualUser.savedAddresses : []
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Cached profile data is not proof of authentication. Wait for /me to
  // validate the server session before exposing any staff-only UI.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [intendedPortal, setIntendedPortal] = useState<UserRole | null>(null);

  useEffect(() => {
    // Check existing authenticated session
    api.auth
      .getMe()
      .then((res) => {
        if (res.user) {
          const sanitized = sanitizeUser(res.user);
          setUser(sanitized);
          if (sanitized) localStorage.setItem('veyrang_user_cache', JSON.stringify(sanitized));
        } else if (res.invalidSession) {
          setUser(null);
          localStorage.removeItem('veyrang_jwt_token');
          localStorage.removeItem('veyrang_user_cache');
        } else if (!res.transientError && !localStorage.getItem('veyrang_jwt_token')) {
          setUser(null);
        }
        // Keep the cached identity for a temporary network/server failure; API calls
        // remain server-authorized and the session will be revalidated on next refresh.
      })
      .catch(() => {
        // Do not log the user out just because session verification had a transient failure.
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
    try {
      const res = await api.auth.login(email, password);
      if (res && res.user) {
        const sanitized = sanitizeUser(res.user);
        if (sanitized) {
          setUser(sanitized);
          try { localStorage.setItem('veyrang_user_cache', JSON.stringify(sanitized)); } catch {}
          setIsAuthModalOpen(false);
          return { success: true, user: sanitized };
        }
      }
      return { success: false, error: 'Invalid login response from server' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Invalid email or password' };
    }
  };

  const register = async (payload: {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    phone?: string;
    address?: string;
    code: string;
  }): Promise<{ success: boolean; pendingApproval?: boolean; message?: string; error?: string }> => {
    try {
      const res = await api.auth.register(payload);
      if (res && res.pendingApproval) {
        return { success: true, pendingApproval: true, message: res.message };
      }
      if (res && res.user) {
        setUser(sanitizeUser(res.user));
        setIsAuthModalOpen(false);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const sendVerification = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.auth.sendVerification(email);
      return { success: res.success };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send verification email' };
    }
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.auth.forgotPassword(email);
      return { success: res.success };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send reset code' };
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await api.auth.resetPassword(email, code, newPassword);
      return { success: res.success };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to reset password' };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setUser(null);
      setIntendedPortal(null);
      try { localStorage.removeItem('veyrang_user_cache'); } catch {}
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('veyrang-user-logout'));
        window.location.href = '/';
      }
    }
  };

  const openAuthModalForPortal = (role: UserRole) => {
    setIntendedPortal(role);
    setIsAuthModalOpen(true);
  };

  const canAccessRole = (role: UserRole): boolean => {
    if (role === 'customer') return true;
    if (!user) return false;
    if (user.role === 'admin') return true; // Super Admin has super-access across all portals
    if (user.role === 'sub_admin') {
      // Sub Admin has direct access to Admin Operations Control Center
      return role === 'admin' || role === 'sub_admin';
    }
    return user.role === role;
  };

  const isPublicPage = (page: ActivePage): boolean => {
    return PUBLIC_PAGES.includes(page);
  };

  const refreshUser = async () => {
    try {
      const res = await api.auth.getMe();
      if (res && res.user) {
        const sanitized = sanitizeUser(res.user);
        setUser(sanitized);
        if (sanitized) localStorage.setItem('veyrang_user_cache', JSON.stringify(sanitized));
      } else if (res.invalidSession) {
        setUser(null);
        localStorage.removeItem('veyrang_jwt_token');
        localStorage.removeItem('veyrang_user_cache');
      }
    } catch (e) {
      console.warn('refreshUser failed:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        sendVerification,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        intendedPortal,
        setIntendedPortal,
        openAuthModalForPortal,
        canAccessRole,
        isPublicPage
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
