'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { attachPackets, getBatchSourceKey, getBatchSourceLabel, getSourceOptions, isHistoricalBatch, matchesSearch } from '@/lib/permitSelectors';
import { loadStore, usePermitStore } from '@/lib/store';

type StatusFilter = 'all' | 'active' | 'historical' | 'open' | 'completed';

function statusBadge(status: string) {
  if (status === 'Historical' || status === 'Imported') return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'Sent to DMV') return 'bg-blue-50 text-blue-800 ring-blue-100';
  if (status === 'Printed') return 'bg-amber-50 text-amber-800 ring-amber-100';
  return 'bg-blue-50 text-blue-800 ring-blue-100';
}

export default function SearchPage() {
  const store = usePermitStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    loadStore().catch(() => void 0);
  }, []);

  const batches = useMemo(() => attachPackets(store), [store]);
  const sourceOptions = useMemo(() => getSourceOptions(batches), [batches]);

  const tabs = useMemo(
    () => [
      { key: 'all', label: 'All', count: batches.length },
      ...sourceOptions.imported.map(([source, counts]) => ({ key: source, label: source, count: counts.batches })),
      { key: 'manual', label: 'Manual / Active', count: sourceOptions.manual.batches },
    ],
    [batches.length, sourceOptions],
  );

  const results = useMemo(() => {
    return batches
      .flatMap((batch) => batch.packets.map((packet) => ({ batch, packet })))
      .filter(({ batch, packet }) => {
        const matchesText = matchesSearch(packet, batch, query);
        const isHistorical = isHistoricalBatch(batch);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'historical' && isHistorical) ||
          (statusFilter === 'active' && !isHistorical) ||
          (statusFilter === 'open' && packet.status !== 'Completed' && packet.status !== 'Imported') ||
          (statusFilter === 'completed' && packet.status === 'Completed');
        const matchesFrom = !fromDate || batch.batchDate >= fromDate;
        const matchesTo = !toDate || batch.batchDate <= toDate;
        const matchesSource =
          sourceFilter === 'all' ||
          (sourceFilter === 'manual' && getBatchSourceKey(batch) === 'Manual') ||
          getBatchSourceKey(batch) === sourceFilter;
        return matchesText && matchesStatus && matchesFrom && matchesTo && matchesSource;
      });
  }, [batches, query, statusFilter, fromDate, toDate, sourceFilter]);

  return (
    <AppShell>
      <div className="surface rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Packet search</h1>
            <p className="text-sm text-slate-600">Find historical packets and active DMV work by stock, customer, batch date, or check number.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Stock #, customer, batch date, check #, notes" value={query} onChange={(e) => setQuery(e.target.value)} />
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

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSourceFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                sourceFilter === tab.key ? 'bg-blue-700 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 md:hidden space-y-3">
          {results.map(({ batch, packet }) => (
            <div key={packet.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{packet.stockNumber || 'Missing stock #'}</div>
                  <div className="text-sm text-slate-600">{packet.customerName || 'Missing customer'}</div>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${statusBadge(packet.status)}`}>
                  {packet.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Batch date</span>{batch.batchDate}</div>
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Check #</span>{batch.checkNumber || '—'}</div>
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Source</span>{getBatchSourceLabel(batch)}</div>
                <div><span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Action</span><Link className="font-semibold text-blue-800" href={`/batches/${batch.id}`}>Open</Link></div>
              </div>
            </div>
          ))}
          {results.length === 0 && <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">No packets match the current filters.</div>}
        </div>

        <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-3">Stock #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Batch date</th>
                <th className="px-4 py-3">Check #</th>
                <th className="px-4 py-3">Source File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ batch, packet }) => (
                <tr key={packet.id} className="border-t border-[var(--border)] bg-white">
                  <td className="px-4 py-3 font-medium text-slate-950">{packet.stockNumber || 'Missing'}</td>
                  <td className="px-4 py-3 text-slate-700">{packet.customerName || 'Missing'}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.batchDate}</td>
                  <td className="px-4 py-3 text-slate-600">{batch.checkNumber || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{getBatchSourceLabel(batch)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${statusBadge(packet.status)}`}>
                      {packet.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 shadow-sm hover:bg-slate-50" href={`/batches/${batch.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={7}>
                    No packets match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
