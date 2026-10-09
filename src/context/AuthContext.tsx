import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { UserRole } from '../types';
import { STORAGE_KEYS, safeGet, safeSet, safeRemove, toUserShell, clearAuthStorage, purgeLegacyAuthoritativeCaches } from '../lib/clientStorage';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  restaurantId?: string;
  address?: string;
  walletBalance?: number;
  avatar?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone?: string; password: string; role?: UserRole }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  openAuthModalForPortal: (role: UserRole) => void;
  pendingPortalRole: UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPortalRole, setPendingPortalRole] = useState<UserRole | null>(null);

  // On mount: restore shell only (never wallet / authoritative balance)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        purgeLegacyAuthoritativeCaches();
        const token = safeGet(STORAGE_KEYS.JWT);
        const cached = safeGet(STORAGE_KEYS.USER_SHELL) || safeGet(STORAGE_KEYS.USER_CACHE_LEGACY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id) {
              // Strip any wallet fields that might have leaked from legacy cache
              const shell = toUserShell(parsed);
              if (mounted) setUser(shell as AuthUser);
            }
          } catch {}
        }
        if (token) {
          const res: any = await api.auth.me().catch((e: any) => ({ transientError: true, error: e }));
          if (!mounted) return;
          if (res && res.id) {
            const sanitized = toUserShell(res);
            setUser(sanitized as AuthUser);
            if (sanitized) safeSet(STORAGE_KEYS.USER_SHELL, JSON.stringify(toUserShell(sanitized as any)));
          } else if (res && !res.transientError) {
            // Hard auth failure — clear
            safeRemove(STORAGE_KEYS.JWT);
            safeRemove(STORAGE_KEYS.USER_SHELL); safeRemove(STORAGE_KEYS.USER_CACHE_LEGACY);
            setUser(null);
          } else if (!res.transientError && !safeGet(STORAGE_KEYS.JWT)) {
            setUser(null);
          }
        }
      } catch {
        // keep shell if present
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res: any = await api.auth.me();
      if (res && res.id) {
        const sanitized = toUserShell(res);
        setUser(sanitized as AuthUser);
        try { safeSet(STORAGE_KEYS.USER_SHELL, JSON.stringify(toUserShell(sanitized as any))); } catch {}
      }
    } catch (err) {
      console.warn('refreshUser failed', err);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await api.auth.login({ email, password });
    if (res?.token) {
      // token already stored by api layer via safeSet
    }
    if (res?.user) {
      const sanitized = toUserShell(res.user);
      setUser(sanitized as AuthUser);
      safeSet(STORAGE_KEYS.USER_SHELL, JSON.stringify(sanitized));
    } else {
      await refreshUser();
    }
    setIsAuthModalOpen(false);
    setPendingPortalRole(null);
  }, [refreshUser]);

  const register = useCallback(async (data: { name: string; email: string; phone?: string; password: string; role?: UserRole }) => {
    const res: any = await api.auth.register(data);
    if (res?.user) {
      const sanitized = toUserShell(res.user);
      setUser(sanitized as AuthUser);
      safeSet(STORAGE_KEYS.USER_SHELL, JSON.stringify(sanitized));
    } else {
      await refreshUser();
    }
    setIsAuthModalOpen(false);
    setPendingPortalRole(null);
  }, [refreshUser]);

  const logout = useCallback(() => {
    try {
      clearAuthStorage();
      safeRemove(STORAGE_KEYS.JWT);
      safeRemove(STORAGE_KEYS.USER_SHELL); safeRemove(STORAGE_KEYS.USER_CACHE_LEGACY);
    } catch {}
    setUser(null);
    setPendingPortalRole(null);
  }, []);

  const openAuthModalForPortal = useCallback((role: UserRole) => {
    setPendingPortalRole(role);
    setIsAuthModalOpen(true);
  }, []);

  // Persist shell on user change (never wallet)
  useEffect(() => {
    if (user) {
      try {
        const sanitized = toUserShell(user);
        if (sanitized) safeSet(STORAGE_KEYS.USER_SHELL, JSON.stringify(toUserShell(sanitized as any)));
      } catch {}
    } else {
      safeRemove(STORAGE_KEYS.JWT);
      safeRemove(STORAGE_KEYS.USER_SHELL); safeRemove(STORAGE_KEYS.USER_CACHE_LEGACY);
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthModalOpen,
        setIsAuthModalOpen,
        login,
        register,
        logout,
        refreshUser,
        openAuthModalForPortal,
        pendingPortalRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
