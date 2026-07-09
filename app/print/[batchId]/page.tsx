'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStore, loadStore } from '@/lib/store';
import { formatDateForPrint, formatMoneyForPrint } from '@/lib/date';

function getPacketPacketYear(batch?: { batchDate?: string | null } | null, packets: Array<{ dateSold?: string | null }> = []) {
  const batchYear = batch?.batchDate ? new Date(batch.batchDate).getFullYear() : NaN;
  if (Number.isFinite(batchYear)) return batchYear;
  for (const packet of packets) {
    if (!packet.dateSold) continue;
    const packetYear = new Date(packet.dateSold).getFullYear();
    if (Number.isFinite(packetYear)) return packetYear;
  }
  return new Date().getFullYear();
}

export default function PrintBatchPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    batch: { id: string; batchDate?: string | null; checkNumber?: string | null; status: string; sheetName?: string | null } | null;
    packets: Array<{
      id: string;
      batchId: string;
      stockNumber?: string | null;
      customerName?: string | null;
      dateSold?: string | null;
      registrationCost?: number | null;
      collectedAmount?: number | null;
      owedAmount?: number | null;
      notes?: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  useEffect(() => {
    let active = true;
    loadStore()
      .then(() => {
        if (!active) return;
        const store = getStore();
        const batch = store.batches.find((item) => item.id === batchId) ?? null;
        const packets = store.packets
          .filter((packet) => packet.batchId === batchId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setSnapshot({ batch, packets });
      })
      .catch(() => void 0)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [batchId]);
  const batch = snapshot?.batch ?? null;
  const packets = snapshot?.packets ?? [];
  const printYear = getPacketPacketYear(batch, packets);
  const printTitle = `Caskinette Ford - Registration Packet ${printYear}`;

  useEffect(() => {
    document.title = printTitle;
  }, [printTitle]);

  if (!ready) return <div className="p-6">Loading print view...</div>;
  if (!batch) return <div className="p-6">Batch not found.</div>;
  return <div className="p-6 print:p-0 print:text-[10px]">
    <div className="print-only mb-3 text-center text-xl font-semibold">{printTitle}</div>
    <div className="mb-4 text-sm no-print"><a href={`/batches/${batch.id}`} className="underline">Back to batch</a></div>
    <table className="w-full table-fixed border-collapse text-[11px] print:text-[10px]">
      <colgroup>
        <col className="w-[12%]" />
        <col className="w-[23%]" />
        <col className="w-[12%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[20%]" />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={7} className="border border-black p-2 text-left text-sm print:text-[11px]">
            {printTitle} | Date: {batch.batchDate} | Check #: {batch.checkNumber || '—'} | Status: {batch.status}
          </th>
        </tr>
        <tr className="border border-black">
          <th className="border border-black p-2">Stock #</th>
          <th className="border border-black p-2">Customer Name</th>
          <th className="border border-black p-2">Date Sold</th>
          <th className="border border-black p-2">Reg. Cost</th>
          <th className="border border-black p-2">Collected</th>
          <th className="border border-black p-2">Owed</th>
          <th className="border border-black p-2">Notes</th>
        </tr>
      </thead>
      <tbody>
        {packets.map((packet) => (
          <tr key={packet.id} className="break-inside-avoid">
            <td className="border border-black p-2 align-top">{packet.stockNumber || ' '}</td>
            <td className="border border-black p-2 align-top">{packet.customerName || ' '}</td>
            <td className="border border-black p-2 align-top">{formatDateForPrint(packet.dateSold, batch.batchDate)}</td>
            <td className="border border-black p-2 align-top">{formatMoneyForPrint(packet.registrationCost)}</td>
            <td className="border border-black p-2 align-top">{formatMoneyForPrint(packet.collectedAmount)}</td>
            <td className="border border-black p-2 align-top">{formatMoneyForPrint(packet.owedAmount)}</td>
            <td className="border border-black p-2 align-top">{packet.notes || ' '}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="packet-footer mt-3 print:mt-3">
      <div className="total-box">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Total</div>
        <div className="mt-2 border-t border-black pt-2 text-base font-semibold">&nbsp;</div>
      </div>
    </div>
  </div>;
}
