'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { loadStore, usePermitStore } from '@/lib/store';
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
  const store = usePermitStore();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    loadStore()
      .catch(() => void 0)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const batch = useMemo(() => store.batches.find((item) => item.id === batchId), [store, batchId]);
  const packets = useMemo(
    () => store.packets
      .filter((packet) => packet.batchId === batchId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [store, batchId],
  );
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
      <tfoot>
        <tr>
          <td colSpan={3} className="border border-black p-2">&nbsp;</td>
          <td colSpan={4} className="border border-black p-2">
            <div className="flex justify-end">
              <div className="w-[220px] rounded border-2 border-black px-4 py-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Total</div>
                <div className="mt-1 border-t border-black pt-2 text-base font-semibold">&nbsp;</div>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>;
}
