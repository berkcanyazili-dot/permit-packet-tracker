'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './AppShell';
import { loadStore, saveStore, usePermitStore } from '@/lib/store';
import { attachPackets, formatMoney, getDashboardStats, matchesSearch } from '@/lib/permitSelectors';
import type { PermitBatch, PermitPacket } from '@/lib/types';

export function PermitApp({ children }: { children: React.ReactNode }) {
  const store = usePermitStore();
  useEffect(() => { loadStore().catch(() => void 0); }, []);
  return <AppShell>{children}</AppShell>;
}

export function DashboardView() {
  const store = usePermitStore();
  const stats = getDashboardStats(store);
  return (
    <PermitApp>
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['Packets created today', stats.createdToday],
          ['Packets printed today', stats.printedToday],
          ['Open packets', stats.openPackets],
          ['Packets with owed amount', stats.activeOwedPackets],
          ['Missing information', stats.missingInfo],
          ['This week', stats.weekPackets],
        ].map(([label, value]) => (
          <div key={String(label)} className="surface rounded-2xl p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{String(value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="surface rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Most recent batch</div>
              <div className="text-xl font-semibold text-slate-950">{stats.recentBatch ? `${stats.recentBatch.batchDate} / ${stats.recentBatch.checkNumber || 'No check #'}` : 'No batches yet'}</div>
            </div>
            <div className="flex gap-2">
              <Link href="/batches/new" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600">New Permit Batch</Link>
              <Link href="/print" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">Print Today’s DMV Packet</Link>
            </div>
          </div>
        </div>
        <div className="surface rounded-2xl p-4">
          <div className="text-sm text-slate-500">Quick links</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/batches" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Batch history</Link>
            <Link href="/search" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Search packets</Link>
            <Link href="/reports" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Reports</Link>
            <Link href="/import" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">Import Excel</Link>
          </div>
        </div>
      </div>
    </PermitApp>
  );
}

export function BatchHistoryView() {
  const store = usePermitStore();
  const batches = attachPackets(store);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => batches.filter((batch) => matchesSearch({ ...batch.packets[0], batchId: batch.id } as PermitPacket, batch, query) || batch.packets.some((packet) => matchesSearch(packet, batch, query))), [batches, query]);
  return <PermitApp><div className="surface rounded-2xl p-4">Batch history placeholder</div></PermitApp>;
}
