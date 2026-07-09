'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { recordActivity, refreshStore } from '@/lib/store';

const IMPORT_STATUS_KEY = 'permit-import-status';

type FileImportSummary = {
  sourceFileName: string;
  worksheetsParsed: number;
  batchesCreated: number;
  batchesSkippedDuplicates: number;
  packetsCreated: number;
  packetsSkippedDuplicates: number;
  rowsWithErrors: number;
  emptySheetsSkipped: number;
  errors: string[];
};

type ImportResponse = {
  ok: boolean;
  syncMode: string;
  importRunId?: string;
  summary: {
    files: FileImportSummary[];
    worksheetsParsed: number;
    batchesImported: number;
    batchesSkipped: number;
    packetsImported: number;
    packetsSkipped: number;
    rowsWithErrors: number;
    errors: string[];
  };
};

type RuntimeStatus = {
  supabaseConfigured: boolean;
  production: boolean;
  permitBatchesTable?: boolean;
  permitPacketsTable?: boolean;
  schemaReady?: boolean;
  schemaError?: string | null;
};

export default function ImportPage() {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [response, setResponse] = useState<ImportResponse | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/runtime-status', { cache: 'no-store' })
      .then((res) => res.json())
      .then(setRuntime)
      .catch(() => setRuntime(null));
  }, []);

  const selectedNames = useMemo(() => selectedFiles.map((file) => file.name), [selectedFiles]);

  return (
    <AppShell>
      <form
        className="surface rounded-3xl p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setMessage('Importing...');
          setResponse(null);

          const form = new FormData();
          selectedFiles.forEach((file) => form.append('files', file));
          if (selectedFiles.length === 0) {
            form.append('source', '/Users/berkcanyazili/Downloads/JOHNN.xlsx');
          }

          const res = await fetch('/api/import', { method: 'POST', body: form });
          const body = (await res.json().catch(() => null)) as ImportResponse | null;

          if (!res.ok || !body?.ok) {
            const error = body?.summary?.errors?.[0] || body?.summary?.files?.find((file) => file.errors.length > 0)?.errors?.[0] || 'Import failed.';
            setMessage(error);
            setResponse(body);
            const nextStatus = { syncMode: body?.syncMode || 'unknown', lastImportAt: new Date().toISOString(), lastResult: 'failed', lastError: error };
            window.localStorage.setItem(IMPORT_STATUS_KEY, JSON.stringify(nextStatus));
            setLoading(false);
            return;
          }

          await refreshStore().catch(() => void 0);
          recordActivity({
            label: 'Imported Excel history',
            detail: `${body.summary.batchesImported} batches / ${body.summary.packetsImported} packets from ${body.summary.files.map((file) => file.sourceFileName).join(', ')}`,
          });
          setResponse(body);
          setMessage('Imported history is ready. You can now search packets by stock number, customer name, batch date, or check number.');
          const nextStatus = { syncMode: body.syncMode || 'unknown', lastImportAt: new Date().toISOString(), lastResult: 'success', lastError: null };
          window.localStorage.setItem(IMPORT_STATUS_KEY, JSON.stringify(nextStatus));
          setLoading(false);
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Import Excel</h1>
            <p className="mt-2 text-sm text-slate-600">Upload one or more workbook files. Import is additive and will not delete existing data.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/batches" className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-100">View Batch History</Link>
            <Link href="/search" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">View Packet Search</Link>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Select files</div>
            <input
              type="file"
              name="files"
              accept=".xlsx,.xls"
              multiple
              className="mt-3 block w-full text-sm"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
            />
            <div className="mt-3 text-sm text-slate-600">
              {selectedFiles.length === 0 ? 'No files selected. You can import JOHNN.xlsx, BOOK2 for john.xlsx, or both.' : `${selectedFiles.length} file(s) selected`}
            </div>
            {selectedNames.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedNames.map((name) => (
                  <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{name}</div>
                ))}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {loading ? 'Importing...' : 'Start Import'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sync status</div>
            <div className="mt-1 font-semibold text-slate-950">
              {runtime?.supabaseConfigured ? 'Database Connected' : 'Local Only'}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div><div className="text-xs text-slate-500">Supabase Connected</div><div className="font-medium text-slate-800">{runtime?.supabaseConfigured ? 'Yes' : 'No'}</div></div>
              <div><div className="text-xs text-slate-500">Schema Ready</div><div className="font-medium text-slate-800">{runtime?.schemaReady ? 'Yes' : 'No'}</div></div>
              <div><div className="text-xs text-slate-500">permit_batches table</div><div className="font-medium text-slate-800">{runtime?.permitBatchesTable ? 'Found' : 'Missing'}</div></div>
              <div><div className="text-xs text-slate-500">permit_packets table</div><div className="font-medium text-slate-800">{runtime?.permitPacketsTable ? 'Found' : 'Missing'}</div></div>
            </div>
            {runtime?.production && (!runtime.supabaseConfigured || !runtime.schemaReady) && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-900">
                {runtime.supabaseConfigured
                  ? 'Database connected, but permit tables are missing. Run the Supabase migration.'
                  : 'Local-only mode: data will not sync across devices. Supabase is not connected.'}
              </div>
            )}
          </div>
        </div>

        {message && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>}

        {response && (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Worksheets parsed</div><div className="mt-1 text-lg font-semibold text-slate-950">{response.summary.worksheetsParsed}</div></div>
              <div><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Batches imported</div><div className="mt-1 text-lg font-semibold text-slate-950">{response.summary.batchesImported}</div></div>
              <div><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Packets imported</div><div className="mt-1 text-lg font-semibold text-slate-950">{response.summary.packetsImported}</div></div>
              <div><div className="text-xs uppercase tracking-[0.16em] text-slate-500">Packets skipped</div><div className="mt-1 text-lg font-semibold text-slate-950">{response.summary.packetsSkipped}</div></div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">Source file</th>
                    <th className="px-4 py-3">Worksheets</th>
                    <th className="px-4 py-3">Batches created</th>
                    <th className="px-4 py-3">Batches skipped</th>
                    <th className="px-4 py-3">Packets created</th>
                    <th className="px-4 py-3">Packets skipped</th>
                    <th className="px-4 py-3">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {response.summary.files.map((file) => (
                    <tr key={file.sourceFileName} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-slate-950">{file.sourceFileName}</td>
                      <td className="px-4 py-3">{file.worksheetsParsed}</td>
                      <td className="px-4 py-3">{file.batchesCreated}</td>
                      <td className="px-4 py-3">{file.batchesSkippedDuplicates + file.emptySheetsSkipped}</td>
                      <td className="px-4 py-3">{file.packetsCreated}</td>
                      <td className="px-4 py-3">{file.packetsSkippedDuplicates}</td>
                      <td className="px-4 py-3">{file.errors.length + file.rowsWithErrors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {response.summary.errors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">{response.summary.errors.join(' • ')}</div>}
            <div className="flex flex-wrap gap-2">
              <Link href="/batches" className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-100">View Imported History</Link>
              <Link href="/search" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Search Packets</Link>
              <Link href="/dashboard" className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">Back to Dashboard</Link>
            </div>
          </div>
        )}
      </form>
    </AppShell>
  );
}
