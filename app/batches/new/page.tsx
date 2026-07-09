'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { loadStore, saveStore, usePermitStore } from '@/lib/store';
import type { PermitBatch } from '@/lib/types';

type NewRow = {
  stockNumber: string;
  customerName: string;
  dateSold: string;
  registrationCost: string;
  collectedAmount: string;
  owedAmount: string;
  notes?: string;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function NewBatchPage() {
  const router = useRouter();
  const store = usePermitStore();
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkNumber, setCheckNumber] = useState('');
  const [rows, setRows] = useState<NewRow[]>([{ stockNumber: '', customerName: '', dateSold: '', registrationCost: '', collectedAmount: '', owedAmount: '' }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { loadStore().catch(() => void 0); }, []);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const rowContainerRef = useRef<HTMLDivElement>(null);

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    const rowAttr = target.getAttribute('data-row');
    const fieldAttr = target.getAttribute('data-field');
    if (rowAttr === null || fieldAttr === null) return;
    e.preventDefault();
    const rowIdx = Number(rowAttr);
    const totalRows = rowsRef.current.length;
    const direction = e.shiftKey ? -1 : 1;
    const nextRowIdx = rowIdx + direction;
    if (nextRowIdx >= 0 && nextRowIdx < totalRows) {
      const next = rowContainerRef.current?.querySelector<HTMLInputElement>(`input[data-row="${nextRowIdx}"][data-field="${fieldAttr}"]`);
      next?.focus();
      next?.select();
    } else if (!e.shiftKey && nextRowIdx === totalRows) {
      setRows((prev) => [...prev, { stockNumber: '', customerName: '', dateSold: '', registrationCost: '', collectedAmount: '', owedAmount: '' }]);
      requestAnimationFrame(() => {
        const next = rowContainerRef.current?.querySelector<HTMLInputElement>(`input[data-row="${nextRowIdx}"][data-field="stockNumber"]`);
        next?.focus();
      });
    }
  }, []);

  return <AppShell><form className="surface space-y-4 rounded-3xl p-5" onSubmit={async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('Saving batch...');
    const now = new Date().toISOString();
    const batch: PermitBatch = {
      id: crypto.randomUUID(),
      batchDate,
      sheetName: `${batchDate}_${store.batches.length + 1}`,
      sourceFileName: '',
      sourceSheetName: '',
      importedAt: null,
      importRunId: '',
      checkNumber,
      batchNumber: 1,
      status: 'Draft',
      notes: '',
      printedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const packets = rows.filter((r) => r.stockNumber || r.customerName).map((r) => ({
      id: crypto.randomUUID(),
      batchId: batch.id,
      sourceFileName: '',
      sourceSheetName: '',
      importedAt: null,
      importRunId: '',
      stockNumber: r.stockNumber,
      customerName: r.customerName,
      dateSold: r.dateSold,
      registrationCost: toNumber(r.registrationCost),
      collectedAmount: toNumber(r.collectedAmount),
      owedAmount: toNumber(r.owedAmount),
      notes: String(r.notes || ''),
      status: 'Not Started' as const,
      createdAt: now,
      updatedAt: now,
    }));
    try {
      await saveStore({ ...store, batches: [batch, ...store.batches], packets: [...packets, ...store.packets], syncMode: store.syncMode });
      setMessage('Batch saved');
      await loadStore().catch(() => void 0);
      setTimeout(() => router.push(`/batches/${batch.id}`), 150);
    } catch {
      setMessage('Could not save batch. Please try again.');
    } finally {
      setSaving(false);
    }
  }}>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm"><div className="text-slate-600">Batch date</div><input type="date" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} /></label>
      <label className="space-y-1 text-sm"><div className="text-slate-600">Check number</div><input className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} /></label>
    </div>
    <div ref={rowContainerRef} onKeyDown={handleGridKeyDown} className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-6">
          {(['stockNumber', 'customerName', 'registrationCost', 'collectedAmount', 'owedAmount'] as const).map((field) => (
            <input key={field} data-row={index} data-field={field} className="rounded-xl border border-[var(--border)] bg-white px-3 py-2" placeholder={field} value={row[field]} onChange={(e) => setRows((prev) => prev.map((item, i) => i === index ? { ...item, [field]: e.target.value } : item))} />
          ))}
          <input data-row={index} data-field="dateSold" type="date" className="rounded-xl border border-[var(--border)] bg-white px-3 py-2" value={row.dateSold} onChange={(e) => setRows((prev) => prev.map((item, i) => i === index ? { ...item, dateSold: e.target.value } : item))} />
        </div>
      ))}
      <button type="button" className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm" onClick={() => setRows((prev) => [...prev, { stockNumber: '', customerName: '', dateSold: '', registrationCost: '', collectedAmount: '', owedAmount: '' }])}>Add row</button>
    </div>
    <div className="flex items-center gap-3">
      <button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60">{saving ? 'Saving...' : 'Save batch'}</button>
      {message && <div className="text-sm font-medium text-slate-700">{message}</div>}
    </div>
  </form></AppShell>;
}
