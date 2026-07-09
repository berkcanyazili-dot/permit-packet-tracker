'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { attachPackets, getBatchSourceKey, getBatchSourceLabel, getSourceOptions, isHistoricalBatch } from '@/lib/permitSelectors';
import { loadStore, usePermitStore } from '@/lib/store';

type StatusFilter = 'all' | 'active' | 'historical' | 'completed' | 'open';

function statusBadge(status: string) {
  if (status === 'Historical') return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'Sent to DMV') return 'bg-blue-50 text-blue-800 ring-blue-100';
  if (status === 'Printed') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-blue-50 text-blue-800 ring-blue-100';
}

export default function BatchesPage() {
  const router = useRouter();
  const store = usePermitStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ batchId: string; batchDate: string; packetCount: number } | null>(null);

  useEffect(() => {
    loadStore().catch(() => void 0);
  }, []);

  const batches = useMemo(() => attachPackets(store), [store]);
  const sourceOptions = useMemo(() => getSourceOptions(batches), [batches]);

  const visibleBatches = useMemo(() => {
    const text = query.trim().toLowerCase();
    return batches.filter((batch) => {
      const matchesText = !text || JSON.stringify(batch).toLowerCase().includes(text);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'historical' && isHistoricalBatch(batch)) ||
        (statusFilter === 'active' && !isHistoricalBatch(batch) && batch.status !== 'Completed') ||
        (statusFilter === 'completed' && batch.status === 'Completed') ||
        (statusFilter === 'open' && batch.status !== 'Completed' && batch.status !== 'Sent to DMV');
      const matchesFrom = !fromDate || batch.batchDate >= fromDate;
      const matchesTo = !toDate || batch.batchDate <= toDate;
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'manual' && getBatchSourceKey(batch) === 'Manual') ||
        getBatchSourceKey(batch) === sourceFilter;
      return matchesText && matchesStatus && matchesFrom && matchesTo && matchesSource;
    });
  }, [batches, query, statusFilter, fromDate, toDate, sourceFilter]);

  const tabs = useMemo(
    () => [
      { key: 'all', label: 'All', count: batches.length },
      ...sourceOptions.imported.map(([source, counts]) => ({ key: source, label: source, count: counts.batches })),
      { key: 'manual', label: 'Manual / Active', count: sourceOptions.manual.batches },
    ],
    [batches.length, sourceOptions],
  );

  const confirmAndDeleteBatch = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    setConfirmDelete({ batchId, batchDate: batch.batchDate, packetCount: batch.packets.length });
  };

  const executeBatchDelete = async (batchId: string) => {
    setConfirmDelete(null);
    setDeletingId(batchId);
    try {
      const response = await fetch(`/api/store?batchId=${encodeURIComponent(batchId)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Could not delete batch.');
      }
      await loadStore().catch(() => void 0);
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          open
          title="Delete this batch?"
          body={`This will permanently remove the batch dated ${confirmDelete.batchDate} and all ${confirmDelete.packetCount} packet${confirmDelete.packetCount !== 1 ? 's' : ''} inside it. This cannot be undone.`}
          confirmLabel="Delete Batch"
          danger
          onConfirm={() => void executeBatchDelete(confirmDelete.batchId)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    <AppShell>
      <div className="surface rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Batch history</h1>
            <p className="text-sm text-slate-600">Browse imported workbook history or today’s active batches by source file.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Search by date, stock, customer, check #" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="historical">Historical</option>
            </select>
            <input type="date" className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {tabs.map((tab) => {
            const active = sourceFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSourceFilter(tab.key)}
                className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                  active ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-semibold text-slate-950">{tab.label}</div>
                <div className="mt-1 text-sm text-slate-600">{tab.count} batches</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={`${tab.key}-pill`}
              type="button"
              onClick={() => setSourceFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                sourceFilter === tab.key ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 md:hidden space-y-3">
          {visibleBatches.map((batch) => (
            <button key={batch.id} type="button" onClick={() => router.push(`/batches/${batch.id}`)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{batch.batchDate}</div>
                  <div className="text-xs text-slate-500">Check # {batch.checkNumber || '—'}</div>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${statusBadge(batch.status)}`}>
                  {isHistoricalBatch(batch) ? 'Historical' : batch.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Packets</span>{batch.packets.length}</div>
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Source</span>{getBatchSourceLabel(batch)}</div>
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Actions</span>Open / Print</div>
              </div>
            </button>
          ))}
          {visibleBatches.length === 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No batches match the current filters.</div>}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">Batch Date</th>
                <th className="px-4 py-3">Check #</th>
                <th className="px-4 py-3">Packet Count</th>
                <th className="px-4 py-3">Source File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleBatches.map((batch) => (
                <tr key={batch.id} onClick={() => router.push(`/batches/${batch.id}`)} className="cursor-pointer border-t border-[var(--border)] hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-950">{batch.batchDate}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.checkNumber || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.packets.length}</td>
                  <td className="px-4 py-3 text-slate-600">{getBatchSourceLabel(batch)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${statusBadge(batch.status)}`}>
                      {isHistoricalBatch(batch) ? 'Historical' : batch.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/batches/${batch.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm" onClick={(e) => e.stopPropagation()}>
                        Open
                      </Link>
                      <Link href={`/print/${batch.id}`} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 shadow-sm" onClick={(e) => e.stopPropagation()}>
                        Print
                      </Link>
                      <button type="button" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 shadow-sm" onClick={(e) => { e.stopPropagation(); confirmAndDeleteBatch(batch.id); }} disabled={deletingId === batch.id}>
                        {deletingId === batch.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleBatches.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>
                    No permit batches match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
    </>
  );
}
