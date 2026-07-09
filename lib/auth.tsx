'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  dealershipName: string;
  organizationId: string;
}

interface AuthValue {
  isAuthenticated: boolean;
  isReady: boolean;
  user: AuthUser | null;
  error: string | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  isAuthenticated: false,
  isReady: false,
  user: null,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  updateUser: async () => {},
});

const AUTH_KEY = 'permit-packet-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          const body = await response.json();
          setUser(body.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = async ({ email, password }: { email: string; password: string }) => {
    setError(null);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body?.error || 'Sign in failed.';
      setError(message);
      throw new Error(message);
    }
    setUser(body.user);
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(body.user));
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    window.localStorage.removeItem(AUTH_KEY);
  };

  const updateUser = async (updates: Partial<AuthUser>) => {
    setUser((current) => current ? { ...current, ...updates } : current);
  };

  const value = useMemo(() => ({
    isAuthenticated: !!user,
    isReady,
    user,
    error,
    signIn,
    signOut,
    updateUser,
  }), [error, isReady, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
