'use client';

import { useEffect, useMemo } from 'react';
import { AppShell } from '@/components/AppShell';
import {
  attachPackets,
  getBatchSourceLabel,
  getImportedHistorySummary,
  isHistoricalBatch,
  isHistoricalPacket,
  isActivePacket,
} from '@/lib/permitSelectors';
import { loadStore, usePermitStore } from '@/lib/store';

export default function ReportsPage() {
  const store = usePermitStore();

  useEffect(() => {
    loadStore().catch(() => void 0);
  }, []);

  const batches = useMemo(() => attachPackets(store), [store]);
  const summary = useMemo(() => getImportedHistorySummary(store), [store]);
  const batchById = useMemo(() => new Map(batches.map((batch) => [batch.id, batch])), [batches]);
  const activePackets = useMemo(
    () =>
      store.packets.filter((packet) => {
        const batch = batchById.get(packet.batchId) || null;
        return batch ? isActivePacket(packet, batch) : false;
      }),
    [store.packets, batchById],
  );
  const historicalPackets = useMemo(
    () =>
      store.packets.filter((packet) => {
        const batch = batchById.get(packet.batchId) || null;
        return batch ? isHistoricalPacket(packet, batch) : false;
      }),
    [store.packets, batchById],
  );
  const openPackets = activePackets.filter((packet) => !['Completed', 'Sent to DMV'].includes(packet.status));
  const packetsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const packet of activePackets) {
      const batch = batchById.get(packet.batchId);
      if (!batch) continue;
      counts.set(batch.batchDate, (counts.get(batch.batchDate) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [activePackets, batchById]);
  const packetsByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const packet of activePackets) {
      const batch = batchById.get(packet.batchId);
      if (!batch) continue;
      const month = batch.batchDate.slice(0, 7);
      counts.set(month, (counts.get(month) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [activePackets, batchById]);
  const importedPacketsByMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const packet of historicalPackets) {
      const batch = batchById.get(packet.batchId);
      if (!batch) continue;
      const month = batch.batchDate.slice(0, 7);
      counts.set(month, (counts.get(month) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [historicalPackets, batchById]);
  const importedBySource = useMemo(() => {
    const counts = new Map<string, number>();
    for (const batch of batches) {
      const key = getBatchSourceLabel(batch);
      if (!isHistoricalBatch(batch)) continue;
      counts.set(key, (counts.get(key) || 0) + batch.packets.length);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [batches]);
  const recentActivity = batches.slice(0, 6);

  return (
    <AppShell>
      <div className="space-y-4">
        <section className="surface rounded-3xl p-5">
          <h1 className="text-2xl font-semibold text-slate-950">Office reports</h1>
          <p className="mt-2 text-sm text-slate-600">Short summaries from active DMV work and imported workbook history.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open active packets</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{openPackets.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Imported history</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{summary.batches}</div>
              <div className="mt-1 text-sm text-slate-600">{summary.packets} packets</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completed packets</div>
              <div className="mt-2 text-3xl font-semibold text-slate-950">{store.packets.filter((packet) => packet.status === 'Completed').length}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Packets by day</h2>
              <span className="text-sm text-slate-500">Active packets only</span>
            </div>
            <div className="mt-4 space-y-2">
              {packetsByDay.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No active packet activity yet.</div>
              ) : (
                packetsByDay.map(([day, count]) => (
                  <div key={day} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <span className="font-medium text-slate-950">{day}</span>
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Packets by month</h2>
              <span className="text-sm text-slate-500">Active packets only</span>
            </div>
            <div className="mt-4 space-y-2">
              {packetsByMonth.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No monthly packet totals yet.</div>
              ) : (
                packetsByMonth.map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <span className="font-medium text-slate-950">{month}</span>
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Imported packets by month</h2>
              <span className="text-sm text-slate-500">Historical imports only</span>
            </div>
            <div className="mt-4 space-y-2">
              {importedPacketsByMonth.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">No imported packet history yet.</div>
              ) : (
                importedPacketsByMonth.map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <span className="font-medium text-slate-950">{month}</span>
                    <span className="text-slate-600">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface rounded-3xl p-5 xl:col-span-2">
            <h2 className="text-lg font-semibold text-slate-950">Imported history and recent activity</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Historical imported packets</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{historicalPackets.length}</div>
                <div className="mt-1 text-sm text-slate-600">{summary.batches} batches imported from Excel</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Imported by source file</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {importedBySource.length === 0 ? (
                    <div>No imported source files yet.</div>
                  ) : (
                    importedBySource.map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0">
                        <span>{source}</span>
                        <span className="text-slate-500">{count} packets</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent activity</div>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  {recentActivity.length === 0 ? (
                    <div>No recent batches yet.</div>
                  ) : (
                    recentActivity.map((batch) => (
                      <div key={batch.id} className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0">
                        <span>{batch.batchDate}</span>
                        <span className="text-slate-500">{batch.packets.length} packets</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
