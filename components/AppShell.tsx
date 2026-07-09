'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ClipboardList, Home, Search, ShieldCheck, BarChart3, Upload, Menu, X } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/batches/new', label: 'New Batch', icon: ClipboardList },
  { href: '/batches', label: 'Batch History', icon: ClipboardList },
  { href: '/search', label: 'Packet Search', icon: Search },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSidebarCollapsed(window.localStorage.getItem('permit-sidebar-collapsed') === 'true');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      window.localStorage.setItem('permit-sidebar-collapsed', String(!current));
      return !current;
    });
  }

  return (
    <div className="page-bg h-screen overflow-hidden">
      <div className="mx-auto flex h-screen max-w-[1800px]">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/25 md:hidden" onClick={() => setMobileMenuOpen(false)}>
            <div className="absolute left-0 top-0 flex h-full w-[18rem] flex-col bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-800">Caskinette Ford</div>
                  <div className="text-base font-semibold text-slate-950">Permit Packet Tracker</div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="mt-4 space-y-1">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Icon className="h-4 w-4 text-slate-500" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">
          <div className="no-print mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm lg:hidden">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Caskinette Ford</div>
              <div className="font-semibold text-slate-950">Permit Packet Tracker</div>
            </div>
            <button onClick={() => setMobileMenuOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
