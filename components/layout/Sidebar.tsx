'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, Home, Search, BarChart3, Settings, FileText, LogOut, PanelLeftClose, PanelLeftOpen, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/batches/new', label: 'Daily Batch', icon: ClipboardList },
  { href: '/batches', label: 'History', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  return (
    <aside className={`hidden min-h-screen shrink-0 border-r border-slate-200/80 bg-white/95 px-3 py-3 shadow-[4px_0_24px_rgba(15,23,42,0.04)] transition-[width] md:flex md:flex-col ${collapsed ? 'w-[4.75rem]' : 'w-[14.5rem]'}`}>
      <div className={`mb-4 flex items-start rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70 ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
        {!collapsed && <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-800">Caskinette Ford</div>
          <div className="mt-1 text-base font-semibold text-slate-950">Permit Packet Tracker</div>
          <div className="mt-1 text-xs text-slate-500">Reception desk workbench</div>
        </div>}
        <button type="button" onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="shrink-0 rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-blue-800">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${
                active
                  ? 'bg-blue-50 text-blue-950 ring-1 ring-inset ring-blue-200 shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-blue-700' : 'text-slate-500'}`} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-200 pt-4">
        <div className={`rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && <><div className="text-sm font-semibold text-slate-950">{user?.name ?? 'Receptionist'}</div>
          <div className="text-xs text-slate-500">{user?.dealershipName ?? 'Caskinette Ford'}</div></>}
          <button
            onClick={() => signOut()}
            title={collapsed ? 'Sign out' : undefined}
            aria-label="Sign out"
            className={`inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${collapsed ? 'px-2' : 'mt-3 gap-2 px-3'}`}
          >
          <LogOut className="h-4 w-4" /> {!collapsed && 'Sign out'}
          </button>
        </div>
      </div>
    </aside>
  );
}
