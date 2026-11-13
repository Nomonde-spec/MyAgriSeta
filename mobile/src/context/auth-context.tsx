import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch, clearStoredToken, getStoredToken, saveStoredToken } from '@/lib/api';

export type AppRole =
  | 'learner'
  | 'farmer'
  | 'employer'
  | 'sdf'
  | 'training_provider'
  | 'administrator'
  | 'internal_staff';

export type SelfRegistrationRole = Exclude<AppRole, 'administrator' | 'internal_staff'>;

type RegistrationDetails = {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  phone?: string;
  role: SelfRegistrationRole;
  verificationDetails: Record<string, string>;
};

type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string;
  activeRole: AppRole;
  roles: AppRole[];
  permissions: string[];
  organization: string;
  status: 'active' | 'inactive';
};

type Session = {
  token: string;
  user: AuthUser;
  availableRoles: AppRole[];
  activeRole: AppRole;
};

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (details: RegistrationDetails) => Promise<{ message: string; status: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (profile: Pick<AuthUser, 'firstName' | 'lastName' | 'phone' | 'organization'>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateSession = async () => {
    setIsLoading(true);
    try {
      const token = await getStoredToken();
      if (!token) {
        setSession(null);
        return;
      }

      const payload = await apiFetch<{ user: AuthUser }>('/me', {
        method: 'GET',
      });

      setSession((current) => ({
        token,
        user: payload.user,
        availableRoles: payload.user.roles,
        activeRole: payload.user.activeRole,
      }));
    } catch {
      await clearStoredToken();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void hydrateSession();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const payload = await apiFetch<{ token: string; user: AuthUser; availableRoles: AppRole[]; activeRole: AppRole }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      await saveStoredToken(payload.token);
      setSession({
        token: payload.token,
        user: payload.user,
        availableRoles: payload.availableRoles,
        activeRole: payload.activeRole,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (details: RegistrationDetails) => {
    setIsLoading(true);
    try {
      return await apiFetch<{ message: string; status: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(details),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    await hydrateSession();
  };

  const updateProfile = (profile: Pick<AuthUser, 'firstName' | 'lastName' | 'phone' | 'organization'>) => {
    setSession((current) => current
      ? { ...current, user: { ...current.user, ...profile } }
      : current);
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      try {
        await clearStoredToken();
      } finally {
        setSession(null);
      }
    }
  };

  const value: AuthContextValue = { session, isLoading, login, register, logout, refreshSession, updateProfile };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
