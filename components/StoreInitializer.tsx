'use client';

import { useEffect, useState } from 'react';
import { initializeStore, setCurrentOrganization } from '@/lib/store';
import { useAuth } from '@/lib/auth';

export default function StoreInitializer({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady, user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function initializeAppStore() {
      if (!isReady) return;

      if (!isAuthenticated || !user) {
        setReady(true);
        return;
      }

      setReady(false);

      try {
        setCurrentOrganization(user.organizationId);
        await initializeStore(user.organizationId);
      } catch (err) {
        console.error('Store init failed:', err);
      }

      if (active) setReady(true);
    }

    initializeAppStore();

    return () => {
      active = false;
    };
  }, [isAuthenticated, isReady, user]);

  if (!isReady || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-page)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
