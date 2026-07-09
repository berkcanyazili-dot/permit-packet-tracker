'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';

export default function SettingsPage() {
  const [message] = useState('');
  const [syncStatus] = useState(() => {
    try {
      const raw = typeof window === 'undefined' ? null : window.localStorage.getItem('permit-import-status');
      return raw ? JSON.parse(raw) as { syncMode?: string; lastImportAt?: string | null; lastResult?: string; lastError?: string | null } : null;
    } catch {
      return null;
    }
  });
  const [runtime, setRuntime] = useState<{ supabaseConfigured: boolean; production: boolean; permitBatchesTable?: boolean; permitPacketsTable?: boolean; schemaReady?: boolean; schemaError?: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/runtime-status', { cache: 'no-store' })
      .then((res) => res.json())
      .then(setRuntime)
      .catch(() => setRuntime(null));
  }, []);

  return (
    <AppShell>
      <div className="surface rounded-3xl p-5">
        <h1 className="text-2xl font-semibold text-slate-950">Settings / Import</h1>
        <p className="mt-2 text-sm text-slate-600">Use this page to review the Supabase connection and import workbook data.</p>
        <div className="mt-4">
          <a href="/import" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600">Open import utility</a>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sync status</div>
          <div className="mt-1 font-semibold text-slate-950">{runtime?.supabaseConfigured ? 'Database Connected' : 'Local Only'}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <div><div className="text-xs text-slate-500">Supabase Connected</div><div className="font-medium text-slate-800">{runtime?.supabaseConfigured ? 'Yes' : 'No'}</div></div>
            <div><div className="text-xs text-slate-500">Schema Ready</div><div className="font-medium text-slate-800">{runtime?.schemaReady ? 'Yes' : 'No'}</div></div>
            <div><div className="text-xs text-slate-500">permit_batches table</div><div className="font-medium text-slate-800">{runtime?.permitBatchesTable ? 'Found' : 'Missing'}</div></div>
            <div><div className="text-xs text-slate-500">permit_packets table</div><div className="font-medium text-slate-800">{runtime?.permitPacketsTable ? 'Found' : 'Missing'}</div></div>
            <div><div className="text-xs text-slate-500">Last sync/import</div><div className="font-medium text-slate-800">{syncStatus?.lastImportAt ? new Date(syncStatus.lastImportAt).toLocaleString() : 'None yet'}</div></div>
            <div><div className="text-xs text-slate-500">Last result</div><div className="font-medium text-slate-800">{syncStatus?.lastResult || 'unknown'}</div></div>
            <div><div className="text-xs text-slate-500">Last error</div><div className="font-medium text-slate-800">{syncStatus?.lastError || runtime?.schemaError || 'None'}</div></div>
          </div>
          {runtime?.production && (!runtime.supabaseConfigured || !runtime.schemaReady) && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-900">
              {runtime.supabaseConfigured
                ? 'Database connected, but permit tables are missing. Run the Supabase migration.'
                : 'Local-only mode: data will not sync across devices. Supabase is not connected.'}
            </div>
          )}
        </div>
        {message && <div className="mt-4 text-sm text-slate-600">{message}</div>}
      </div>
    </AppShell>
  );
}
