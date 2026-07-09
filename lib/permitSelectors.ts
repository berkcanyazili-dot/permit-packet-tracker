import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import type { BatchWithPackets, PermitBatch, PermitPacket, PermitStore } from './types';

const HISTORICAL_BATCH_STATUSES = new Set(['Historical', 'Imported']);
const HISTORICAL_PACKET_STATUSES = new Set(['Imported', 'Historical']);
const ACTIVE_BATCH_STATUSES = new Set(['Draft', 'Ready to Print', 'Printed', 'Sent to DMV']);
const ACTIVE_PACKET_STATUSES = new Set(['Not Started', 'Ready', 'Printed', 'Sent to DMV', 'Issue']);

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isHistoricalBatch(batch: PermitBatch) {
  if (HISTORICAL_BATCH_STATUSES.has(batch.status)) return true;
  if (batch.sourceFileName || batch.importedAt || batch.importRunId) return true;
  if (batch.id.startsWith('batch-')) return true;
  return batch.batchDate < todayKey() && batch.createdAt.slice(0, 10) !== batch.batchDate;
}

export function isActiveBatch(batch: PermitBatch) {
  return !isHistoricalBatch(batch) && ACTIVE_BATCH_STATUSES.has(batch.status);
}

export function isHistoricalPacket(packet: PermitPacket, batch?: PermitBatch | null) {
  if (HISTORICAL_PACKET_STATUSES.has(packet.status)) return true;
  if (packet.sourceFileName || packet.sourceSheetName || packet.importedAt || packet.importRunId) return true;
  if (packet.id.startsWith('packet-')) return true;
  return batch ? isHistoricalBatch(batch) : false;
}

export function isActivePacket(packet: PermitPacket, batch?: PermitBatch | null) {
  return !isHistoricalPacket(packet, batch) && ACTIVE_PACKET_STATUSES.has(packet.status);
}

export function attachPackets(store: PermitStore): BatchWithPackets[] {
  const packetsByBatch = new Map<string, PermitPacket[]>();
  for (const packet of store.packets) {
    const list = packetsByBatch.get(packet.batchId) || [];
    list.push(packet);
    packetsByBatch.set(packet.batchId, list);
  }
  return store.batches
    .map((batch) => ({ ...batch, packets: packetsByBatch.get(batch.id) || [] }))
    .sort((a, b) => b.batchDate.localeCompare(a.batchDate) || b.createdAt.localeCompare(a.createdAt));
}

export function getDashboardStats(store: PermitStore) {
  const today = todayKey();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 });
  const batches = attachPackets(store);
  const activeBatches = batches.filter(isActiveBatch);
  const historicalBatches = batches.filter(isHistoricalBatch);

  const packets = store.packets;
  const todayPackets = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch?.batchDate === today && !isHistoricalBatch(batch);
  });
  const todayBatches = activeBatches.filter((batch) => batch.batchDate === today);
  const printedToday = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch?.batchDate === today && p.status === 'Printed';
  });
  const openPackets = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isActivePacket(p, batch) && !['Completed', 'Sent to DMV'].includes(p.status) : false;
  });
  const activeOwedPackets = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isActivePacket(p, batch) && (p.owedAmount || 0) > 0 : false;
  });
  const activeMissingInfo = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isActivePacket(p, batch) && (!p.stockNumber || !p.customerName || !p.dateSold) : false;
  });
  const historicalMissingInfo = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isHistoricalPacket(p, batch) && (!p.stockNumber || !p.customerName || !p.dateSold) : false;
  });
  const recentBatch = batches[0] || null;
  const importedPackets = packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isHistoricalPacket(p, batch) : false;
  });

  return {
    createdToday: todayPackets.length,
    createdTodayBatches: todayBatches.length,
    printedToday: printedToday.length,
    openPackets: openPackets.length,
    activeOwedPackets: activeOwedPackets.length,
    missingInfo: activeMissingInfo.length,
    historicalMissingInfo: historicalMissingInfo.length,
    recentBatch,
    importedBatches: historicalBatches.length,
    importedPackets: importedPackets.length,
    weekPackets: packets.filter((p) => {
      const batch = batches.find((item) => item.id === p.batchId) || null;
      return batch ? !isHistoricalBatch(batch) && isWithinInterval(parseISO(batch.batchDate), { start: weekStart, end: weekEnd }) : false;
    }).length,
  };
}

export function getDashboardWorkflow(store: PermitStore) {
  const batches = attachPackets(store);
  const activeBatches = batches.filter(isActiveBatch);
  const activePackets = store.packets.filter((packet) => {
    const batch = batches.find((item) => item.id === packet.batchId) || null;
    return batch ? isActivePacket(packet, batch) : false;
  });
  const printedCount = activePackets.filter((packet) => packet.status === 'Printed').length;
  const completedCount = activeBatches.filter((batch) => batch.status === 'Completed').length;
  return [
    {
      label: 'Create permit batch',
      status: activeBatches.length === 0 ? 'Not started' : 'Ready',
      helper: activeBatches.length === 0 ? 'Start today’s DMV packet batch.' : `${activeBatches.length} active batches`,
    },
    {
      label: 'Add packet rows',
      status: activePackets.length === 0 ? 'Not started' : 'In progress',
      helper: activePackets.length === 0 ? 'Add stock numbers and customer names.' : `${activePackets.length} active packets`,
    },
    {
      label: 'Print DMV sheet',
      status: printedCount === 0 ? 'Not started' : 'Ready',
      helper: printedCount === 0 ? 'Print once the batch is complete.' : `${printedCount} packets printed`,
    },
    {
      label: 'Mark batch completed',
      status: completedCount === 0 ? 'Not started' : 'Completed',
      helper: completedCount === 0 ? 'Close batches after DMV submission.' : `${completedCount} batches completed`,
    },
  ];
}

export function getDashboardAttention(store: PermitStore) {
  const batches = attachPackets(store);
  const owedPackets = store.packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isActivePacket(p, batch) && (p.owedAmount || 0) > 0 : false;
  });
  const missingInfo = store.packets.filter((p) => {
    const batch = batches.find((item) => item.id === p.batchId) || null;
    return batch ? isActivePacket(p, batch) && (!p.stockNumber || !p.customerName || !p.dateSold) : false;
  });
  return {
    owedCount: owedPackets.length,
    missingCount: missingInfo.length,
    owedPreview: owedPackets.slice(0, 3),
    missingPreview: missingInfo.slice(0, 3),
  };
}

export function getRecentBatches(store: PermitStore) {
  return attachPackets(store)
    .slice()
    .slice(0, 5);
}

export function getBatchSourceLabel(batch: BatchWithPackets) {
  if (batch.sourceFileName) return batch.sourceFileName;
  if (isHistoricalBatch(batch)) return 'Excel import';
  return 'Manual';
}

export function getBatchSourceKey(batch: BatchWithPackets) {
  if (batch.sourceFileName) return batch.sourceFileName;
  if (isHistoricalBatch(batch)) return 'Excel import';
  return 'Manual';
}

export function isImportedSource(batch: BatchWithPackets) {
  return Boolean(batch.sourceFileName) || isHistoricalBatch(batch);
}

export function getSourceOptions(batches: BatchWithPackets[]) {
  const sourceCounts = new Map<string, { batches: number; packets: number }>();
  let manualBatches = 0;
  let manualPackets = 0;

  for (const batch of batches) {
    const source = getBatchSourceKey(batch);
    const current = sourceCounts.get(source) || { batches: 0, packets: 0 };
    current.batches += 1;
    current.packets += batch.packets.length;
    sourceCounts.set(source, current);

    if (source === 'Manual') {
      manualBatches += 1;
      manualPackets += batch.packets.length;
    }
  }

  const imported = [...sourceCounts.entries()]
    .filter(([source]) => source !== 'Manual')
    .sort((a, b) => b[1].batches - a[1].batches || a[0].localeCompare(b[0]));

  return {
    imported,
    manual: { batches: manualBatches, packets: manualPackets },
  };
}

export function getMonthlyPacketCount(store: PermitStore) {
  const monthKey = format(new Date(), 'yyyy-MM');
  return store.packets.filter((packet) => {
    const batch = store.batches.find((item) => item.id === packet.batchId) || null;
    return batch ? !isHistoricalBatch(batch) && batch.batchDate.startsWith(monthKey) : false;
  }).length;
}

export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

export function matchesSearch(packet: PermitPacket, batch?: PermitBatch | null, query = '') {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [
    packet.stockNumber,
    packet.customerName,
    packet.dateSold,
    packet.notes,
    batch?.batchDate,
    batch?.checkNumber,
    batch?.sheetName,
    batch?.sourceFileName,
    batch?.sourceSheetName,
    packet.sourceFileName,
    packet.sourceSheetName,
  ].some((value) => String(value || '').toLowerCase().includes(text));
}

export function getImportedHistorySummary(store: PermitStore) {
  const batches = attachPackets(store);
  const importedBatches = batches.filter(isHistoricalBatch);
  const importedPackets = store.packets.filter((packet) => {
    const batch = batches.find((item) => item.id === packet.batchId) || null;
    return batch ? isHistoricalPacket(packet, batch) : false;
  });
  return {
    batches: importedBatches.length,
    packets: importedPackets.length,
  };
}
