'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SaveBar } from '@/components/ui/SaveBar';
import { recordActivity, saveStore, loadStore, usePermitStore } from '@/lib/store';
import { toDateInputValue } from '@/lib/date';
import { isHistoricalBatch } from '@/lib/permitSelectors';
import type { PermitBatch, PermitPacket } from '@/lib/types';

function packetLabel(value: string, fallback: string) {
  return value || fallback;
}


function createBlankPacket(batchId: string): PermitPacket {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    batchId,
    sourceFileName: '',
    sourceSheetName: '',
    importedAt: null,
    importRunId: '',
    stockNumber: '',
    customerName: '',
    dateSold: '',
    registrationCost: null,
    collectedAmount: null,
    owedAmount: null,
    notes: '',
    status: 'Not Started',
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeDraftPacket(packet: PermitPacket) {
  return {
    ...packet,
    stockNumber: packet.stockNumber || '',
    customerName: packet.customerName || '',
    dateSold: packet.dateSold || '',
    notes: packet.notes || '',
    registrationCost: packet.registrationCost === undefined ? null : packet.registrationCost,
    collectedAmount: packet.collectedAmount === undefined ? null : packet.collectedAmount,
    owedAmount: packet.owedAmount === undefined ? null : packet.owedAmount,
  };
}

function withDraftOrder(packets: PermitPacket[], batchId: string) {
  return packets.map((packet, idx) => ({ ...packet, batchId, sortOrder: idx }));
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const store = usePermitStore();

  useEffect(() => {
    loadStore().catch(() => void 0);
  }, []);

  const batch = useMemo(() => store.batches.find((item) => item.id === batchId), [store.batches, batchId]);
  const packets = useMemo(
    () => store.packets
      .filter((packet) => packet.batchId === batchId)
      .sort((a, b) => {
        if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
        if (a.sortOrder !== undefined) return -1;
        if (b.sortOrder !== undefined) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [store.packets, batchId],
  );

  if (!batch) return <AppShell><div className="surface rounded-3xl p-5">Batch not found.</div></AppShell>;

  return <BatchEditor key={batch.id} batch={batch} packets={packets} store={store} />;
}

function BatchEditor({ batch, packets, store }: { batch: PermitBatch; packets: PermitPacket[]; store: ReturnType<typeof usePermitStore> }) {
  const initialPacketDrafts = () => withDraftOrder(packets.map(normalizeDraftPacket), batch.id);
  const [packetDrafts, setPacketDrafts] = useState<PermitPacket[]>(initialPacketDrafts);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const packetDraftsRef = useRef(packetDrafts);

  const updatePacketDrafts = useCallback((updater: (current: PermitPacket[]) => PermitPacket[]) => {
    setPacketDrafts((current) => {
      const ordered = withDraftOrder(updater(current), batch.id);
      packetDraftsRef.current = ordered;
      return ordered;
    });
  }, [batch.id]);

  // If the store loaded asynchronously after this component mounted, packetDrafts will be
  // empty even though packets from the server are now available. Sync once, the first time
  // packets arrive, but never overwrite user edits after that.
  const packetsSynced = useRef(packets.length > 0);
  useEffect(() => {
    if (!packetsSynced.current && packets.length > 0) {
      packetsSynced.current = true;
      const ordered = withDraftOrder(packets.map(normalizeDraftPacket), batch.id);
      packetDraftsRef.current = ordered;
      setPacketDrafts(ordered);
    }
  }, [batch.id, packets]);
  const [batchDate, setBatchDate] = useState(batch.batchDate);
  const [checkNumber, setCheckNumber] = useState(batch.checkNumber);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);
  const historical = isHistoricalBatch(batch);

  const readVisibleDrafts = () => {
    const rows = Array.from(tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-packet-id]') ?? []);
    const draftsById = new Map(packetDraftsRef.current.map((packet) => [packet.id, packet]));
    if (!rows.length) return packetDraftsRef.current;

    return rows.flatMap((row, sortOrder) => {
      const packet = draftsById.get(row.dataset.packetId || '');
      if (!packet) return [];
      const read = (field: string) => row.querySelector<HTMLInputElement>(`input[data-field="${field}"]`)?.value ?? '';
      const numberOrNull = (field: string) => {
        const value = read(field);
        return value === '' ? null : Number(value);
      };
      return [{
        ...packet,
        stockNumber: read('stockNumber'),
        customerName: read('customerName'),
        dateSold: read('dateSold'),
        registrationCost: numberOrNull('registrationCost'),
        collectedAmount: numberOrNull('collectedAmount'),
        owedAmount: numberOrNull('owedAmount'),
        notes: read('notes'),
        sortOrder,
      }];
    });
  };

  const persist = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const filteredPackets = readVisibleDrafts()
      .filter((packet) => packet.stockNumber.trim() || packet.customerName.trim())
      .map((packet, idx) => ({ ...packet, batchId: batch.id, sortOrder: idx, updatedAt: now }));
    const updatedBatch = { ...batch, batchDate, checkNumber, updatedAt: now };
    const nextStore = {
      ...store,
      batches: store.batches.map((item) => (item.id === batch.id ? updatedBatch : item)),
      packets: [
        ...store.packets.filter((packet) => packet.batchId !== batch.id),
        ...filteredPackets,
      ],
      syncMode: store.syncMode,
    };
    try {
      setSaveError(null);
      await saveStore(nextStore, { reconcilePacketBatchIds: [batch.id] });
      packetDraftsRef.current = filteredPackets;
      setPacketDrafts(filteredPackets);
      setDirty(false);
      setLastSaved(new Date());
      recordActivity({ label: 'Batch saved', detail: `${batchDate} · ${checkNumber || 'No check #'}` });
    } catch (err) {
      setDirty(true);
      setSaveError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updatePacketDraft = (packetId: string, patch: Partial<PermitPacket>) => {
    updatePacketDrafts((prev) => prev.map((packet) => (packet.id === packetId ? { ...packet, ...patch } : packet)));
    setDirty(true);
  };

  const addPacketRow = () => {
    updatePacketDrafts((prev) => [...prev, createBlankPacket(batch.id)]);
    setDirty(true);
  };

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;

    const rowAttr = target.getAttribute('data-row');
    const fieldAttr = target.getAttribute('data-field');
    if (rowAttr === null || fieldAttr === null) return;

    e.preventDefault();

    const rowIdx = Number(rowAttr);
    const totalRows = packetDraftsRef.current.length;
    const direction = e.shiftKey ? -1 : 1;
    const nextRowIdx = rowIdx + direction;

    if (nextRowIdx >= 0 && nextRowIdx < totalRows) {
      const selector = `input[data-row="${nextRowIdx}"][data-field="${fieldAttr}"]`;
      const next = tbodyRef.current?.querySelector<HTMLInputElement>(selector);
      next?.focus();
      next?.select();
    } else if (!e.shiftKey && nextRowIdx === totalRows) {
      // At the last row pressing Enter: add a new row, then focus its first field
      const newPacket = createBlankPacket(batch.id);
      updatePacketDrafts((prev) => [...prev, newPacket]);
      setDirty(true);
      // Focus happens after React re-renders — use a brief rAF wait
      requestAnimationFrame(() => {
        const selector = `input[data-row="${nextRowIdx}"][data-field="stockNumber"]`;
        const next = tbodyRef.current?.querySelector<HTMLInputElement>(selector);
        next?.focus();
      });
    }
  }, [batch.id, updatePacketDrafts]);

  const deletePacketRow = (packetId: string) => {
    setConfirmDialog({
      title: 'Delete this packet?',
      body: 'This row will be removed. The change won\'t be permanent until you click Save Changes.',
      onConfirm: () => {
        updatePacketDrafts((prev) => prev.filter((p) => p.id !== packetId));
        setDirty(true);
        setConfirmDialog(null);
      },
    });
  };

  const movePacketRow = (index: number, direction: 'up' | 'down') => {
    updatePacketDrafts((prev) => {
      const next = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
    setDirty(true);
  };

  const deleteBatch = () => {
    setConfirmDialog({
      title: 'Delete this batch?',
      body: `This will permanently remove the batch dated ${batch.batchDate} and all ${packetDrafts.length} packet${packetDrafts.length !== 1 ? 's' : ''} inside it. This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingBatch(true);
        try {
          const response = await fetch(`/api/store?batchId=${encodeURIComponent(batch.id)}`, { method: 'DELETE', credentials: 'include' });
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new Error(body?.error || 'Could not delete batch.');
          }
          await loadStore().catch(() => void 0);
          recordActivity({ label: 'Deleted batch', detail: `${batch.batchDate} · ${batch.checkNumber || 'No check #'}` });
          window.location.href = '/batches';
        } catch (error) {
          console.error(error);
        } finally {
          setDeletingBatch(false);
        }
      },
    });
  };

  const discardChanges = () => {
    setConfirmDialog({
      title: 'Discard changes?',
      body: 'All unsaved changes to this batch will be lost.',
      onConfirm: () => {
        const ordered = withDraftOrder(packets.map(normalizeDraftPacket), batch.id);
        packetDraftsRef.current = ordered;
        setPacketDrafts(ordered);
        setBatchDate(batch.batchDate);
        setCheckNumber(batch.checkNumber);
        setDirty(false);
        setConfirmDialog(null);
      },
    });
  };

  return (
    <>
      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.title.startsWith('Delete') ? 'Delete' : 'Discard'}
          danger={confirmDialog.title.startsWith('Delete') || confirmDialog.title.startsWith('Discard')}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    <AppShell>
      <div className="surface rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-950">{historical ? 'Historical Batch' : 'Daily Batch Entry'}</h1>
              {dirty && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                  Editing
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="shrink-0">Batch Date:</span>
                <input
                  type="date"
                  value={batchDate}
                  disabled={saving}
                  onChange={(e) => { setBatchDate(e.target.value); setDirty(true); }}
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-slate-950 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="shrink-0">Check #:</span>
                <input
                  value={checkNumber}
                  disabled={saving}
                  onChange={(e) => { setCheckNumber(e.target.value); setDirty(true); }}
                  placeholder="—"
                  className="w-36 rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-slate-950 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>
            </div>
            <div className="mt-1 text-sm text-slate-600">Sheet: {batch.sheetName}</div>
            {batch.sourceFileName && <div className="mt-1 text-sm text-slate-600">Source: {batch.sourceFileName}</div>}
            {batch.sourceSheetName && <div className="mt-1 text-sm text-slate-600">Source sheet: {batch.sourceSheetName}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/print/${batch.id}`} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
              Print / Export
            </Link>
            <button type="button" onClick={deleteBatch} disabled={deletingBatch || saving} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm disabled:opacity-60">
              {deletingBatch ? 'Deleting…' : 'Delete Batch…'}
            </button>
          </div>
        </div>

        <SaveBar
          dirty={dirty}
          saving={saving}
          lastSaved={lastSaved}
          onSave={() => void persist()}
          onDiscard={discardChanges}
        />
        {saveError && (
          <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            Save failed: {saveError}
          </div>
        )}

        {historical && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            ✏️ This batch was imported from Excel history. Edit any field then click <strong>Save Changes</strong> to update it.
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">{packetDrafts.length} packet{packetDrafts.length !== 1 ? 's' : ''} in this batch</div>
          <button type="button" onClick={addPacketRow} disabled={saving} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-60">
            + Add Row
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1060px] w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[60px]" />
              <col className="w-[48px]" />
              <col className="w-[110px]" />
              <col className="w-[280px]" />
              <col className="w-[130px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <th className="px-2 py-3"><span className="sr-only">Reorder</span></th>
                <th className="px-3 py-3"><span className="sr-only">Delete</span></th>
                <th className="px-4 py-3">Stock #</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Date Sold</th>
                <th className="px-4 py-3">Reg. Cost</th>
                <th className="px-4 py-3">Collected</th>
                <th className="px-4 py-3">Owed</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef} onKeyDown={handleGridKeyDown}>
              {packetDrafts.map((packet, idx) => (
                <tr key={packet.id} data-packet-id={packet.id} className="border-t border-[var(--border)]">
                  <td className="px-2 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => movePacketRow(idx, 'up')} disabled={saving || idx === 0} aria-label="Move row up" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 active:bg-slate-100">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => movePacketRow(idx, 'down')} disabled={saving || idx === packetDrafts.length - 1} aria-label="Move row down" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 active:bg-slate-100">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <button type="button" onClick={() => deletePacketRow(packet.id)} disabled={saving} aria-label="Delete packet" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-400 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="stockNumber" aria-label="Stock number" disabled={saving} value={packet.stockNumber} onChange={(e) => updatePacketDraft(packet.id, { stockNumber: e.target.value })} placeholder="e.g. 12345" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="customerName" aria-label="Customer name" disabled={saving} value={packet.customerName} onChange={(e) => updatePacketDraft(packet.id, { customerName: e.target.value })} placeholder="Full name" className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="dateSold" type="date" aria-label="Date sold" disabled={saving} value={toDateInputValue(packet.dateSold, batch.batchDate)} onChange={(e) => updatePacketDraft(packet.id, { dateSold: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="registrationCost" type="number" step="0.01" aria-label="Registration cost" disabled={saving} value={packet.registrationCost ?? ''} onChange={(e) => updatePacketDraft(packet.id, { registrationCost: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="collectedAmount" type="number" step="0.01" aria-label="Collected amount" disabled={saving} value={packet.collectedAmount ?? ''} onChange={(e) => updatePacketDraft(packet.id, { collectedAmount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="owedAmount" type="number" step="0.01" aria-label="Amount owed" disabled={saving} value={packet.owedAmount ?? ''} onChange={(e) => updatePacketDraft(packet.id, { owedAmount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></td>
                  <td className="px-4 py-3 align-top"><input data-row={idx} data-packet-id={packet.id} data-field="notes" aria-label="Notes" disabled={saving} value={packet.notes} onChange={(e) => updatePacketDraft(packet.id, { notes: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="Optional notes" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {packetDrafts.map((packet, idx) => (
            <div key={packet.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{packetLabel(packet.stockNumber, 'Missing stock #')}</div>
                  <div className="text-sm text-slate-600">{packetLabel(packet.customerName, 'Missing customer name')}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => movePacketRow(idx, 'up')} disabled={saving || idx === 0} aria-label="Move row up" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 active:bg-slate-100">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => movePacketRow(idx, 'down')} disabled={saving || idx === packetDrafts.length - 1} aria-label="Move row down" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-400 shadow-sm hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 active:bg-slate-100">
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                  <button type="button" onClick={() => deletePacketRow(packet.id)} disabled={saving} aria-label="Delete packet" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Date Sold</span><input type="date" disabled={saving} value={toDateInputValue(packet.dateSold, batch.batchDate)} onChange={(e) => updatePacketDraft(packet.id, { dateSold: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" /></label>
                <label className="text-sm"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Reg. Cost</span><input type="number" step="0.01" aria-label="Registration cost" disabled={saving} value={packet.registrationCost ?? ''} onChange={(e) => updatePacketDraft(packet.id, { registrationCost: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></label>
                <label className="text-sm"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Collected</span><input type="number" step="0.01" aria-label="Collected amount" disabled={saving} value={packet.collectedAmount ?? ''} onChange={(e) => updatePacketDraft(packet.id, { collectedAmount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></label>
                <label className="text-sm"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Owed</span><input type="number" step="0.01" aria-label="Amount owed" disabled={saving} value={packet.owedAmount ?? ''} onChange={(e) => updatePacketDraft(packet.id, { owedAmount: e.target.value === '' ? null : Number(e.target.value) })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="0.00" /></label>
                <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs uppercase tracking-[0.14em] text-slate-500">Notes</span><input aria-label="Notes" disabled={saving} value={packet.notes} onChange={(e) => updatePacketDraft(packet.id, { notes: e.target.value })} className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" placeholder="Optional notes" /></label>
              </div>
            </div>
          ))}
          {!packetDrafts.length && <div className="text-sm text-slate-600">No packets in this batch.</div>}
        </div>
      </div>
    </AppShell>
    </>
  );
}
