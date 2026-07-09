'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  CalendarClock,
  ClipboardList,
  Inbox,
  Plus,
  Printer,
  UploadCloud,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { loadStore, usePermitStore } from '@/lib/store';
import {
  getBatchSourceLabel,
  getDashboardStats,
  getRecentBatches,
  getSourceOptions,
  attachPackets,
} from '@/lib/permitSelectors';
import { getActivityLog } from '@/lib/store';

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="surface rounded-2xl border border-slate-200/80 p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700 ring-1 ring-inset ring-blue-100">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">{String(value)}</div>
          <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{helper}</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const store = usePermitStore();
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    loadStore().catch(() => void 0);
  }, []);

  const stats = useMemo(() => getDashboardStats(store), [store]);
  const recentBatches = useMemo(() => getRecentBatches(store), [store]);
  const sourceOptions = getSourceOptions(attachPackets(store));
  const activityLog = getActivityLog();
  const showPrintedToday = stats.printedToday > 0;
  const showRecentActivity = activityLog.length > 0;

  return (
    <AppShell>
      <div className="space-y-4 pb-6">
        <section className="surface overflow-hidden rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="bg-gradient-to-r from-blue-50 via-white to-slate-50 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Daily Permit Workbench</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Track today’s DMV permit packets, print batch sheets, and review recent batches.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link href="/batches/new" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
                    <Plus className="h-4 w-4" />
                    New Permit Batch
                  </Link>
                  <Link href="/print" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
                    <Printer className="h-4 w-4" />
                    Print Today’s DMV Packet
                  </Link>
                  <Link href="/import" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <UploadCloud className="h-4 w-4" />
                    Import Excel Data
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={ClipboardList}
            label="Today’s Packets"
            value={stats.createdToday}
            helper={stats.createdToday === 0 ? 'No packets entered for today yet' : 'Linked to today’s batch date'}
          />
          <StatCard
            icon={Printer}
            label="Today’s Batches"
            value={stats.createdTodayBatches}
            helper={stats.createdTodayBatches === 0 ? 'No active batches dated today' : 'Batches dated for today'}
          />
          <StatCard
            icon={Inbox}
            label="Active / Open Packets"
            value={stats.openPackets}
            helper={stats.openPackets === 0 ? 'All active packets are closed' : 'Still waiting on completion'}
          />
          <StatCard
            icon={CalendarClock}
            label="Imported History"
            value={`${stats.importedBatches} batches / ${stats.importedPackets} packets`}
            helper={
              stats.importedBatches === 0
                ? 'No imported workbook history yet'
                : `${sourceOptions.imported
                    .slice(0, 2)
                    .map(([source, counts]) => `${source}: ${counts.batches} / ${counts.packets}`)
                    .join(' · ')}${sourceOptions.imported.length > 2 ? ' · more' : ''}`
            }
          />
          {showPrintedToday && (
            <StatCard
              icon={Printer}
              label="Packets Printed Today"
              value={stats.printedToday}
              helper="Printed and ready"
            />
          )}
          <StatCard
            icon={CalendarClock}
            label="Most Recent Batch"
            value={stats.recentBatch ? stats.recentBatch.batchDate : 'None'}
            helper={
              stats.recentBatch
                ? `${stats.recentBatch.status === 'Historical' ? 'Historical' : 'Active'} · Check # ${stats.recentBatch.checkNumber || '—'} · ${stats.recentBatch.packets.length} packets${getBatchSourceLabel(stats.recentBatch) ? ` · ${getBatchSourceLabel(stats.recentBatch)}` : ''}`
                : 'Create today’s first batch or import Excel history'
            }
          />
        </section>
        <section className="surface rounded-3xl border border-slate-200/80 p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent Batches</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Latest work in the office queue</h2>
            </div>
            <Link href="/batches" className="text-sm font-semibold text-blue-800 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="hidden grid-cols-[1.2fr_0.85fr_0.65fr_0.9fr_0.75fr] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid">
                <div>Batch Date</div>
                <div>Check #</div>
                <div>Packets</div>
                <div>Status</div>
                <div>Actions</div>
            </div>
            {recentBatches.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-500">
                No permit batches yet. Create today’s first batch or import Excel history.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="m-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:m-0 md:grid md:grid-cols-[1.2fr_0.85fr_0.65fr_0.9fr_0.75fr] md:items-center md:gap-3 md:border-0 md:px-4 md:py-2.5 md:shadow-none"
                  >
                    <div className="text-sm font-semibold text-slate-950">
                      <div>{batch.batchDate}</div>
                      {batch.status === 'Historical' && (
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Historical import</div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 md:mt-0">{batch.checkNumber || '—'}</div>
                    <div className="mt-2 text-sm text-slate-600 md:mt-0">{batch.packets.length}</div>
                    <div className="mt-2 md:mt-0">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${
                        batch.status === 'Historical'
                          ? 'bg-slate-100 text-slate-700 ring-slate-200'
                          : batch.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                            : 'bg-blue-50 text-blue-800 ring-blue-100'
                      }`}>
                        {batch.status === 'Historical' ? 'Historical' : batch.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 md:mt-0">
                      <Link href={`/batches/${batch.id}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                        Open
                      </Link>
                      <Link href={`/print/${batch.id}`} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-100">
                        Print
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {showRecentActivity && (
          <section className="surface rounded-3xl border border-slate-200/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent activity</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Latest import and edit trail</h2>
              </div>
              {activityLog.length > 3 && <button type="button" onClick={() => setActivityExpanded((value) => !value)} className="text-sm font-semibold text-blue-800 hover:text-blue-700">{activityExpanded ? 'Show less' : 'View all'}</button>}
            </div>
            <div className="mt-4 space-y-2">
              {activityLog.slice(0, activityExpanded ? activityLog.length : 3).map((entry) => (
                <div key={`${entry.at}-${entry.label}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <div className="text-sm font-semibold text-slate-950">{entry.label}</div>
                  <div className="mt-1 text-sm text-slate-600">{entry.detail || 'Recorded change'}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
