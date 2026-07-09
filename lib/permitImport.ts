import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { SSF, read, utils } from 'xlsx/xlsx.mjs';
import type { PermitBatch, PermitPacket, PermitStore } from './types';

export function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export function normalizeDate(value: unknown) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const parsed = SSF.parse_date_code(value);
    if (parsed) {
      const year = parsed.y ?? new Date().getFullYear();
      const month = (parsed.m ?? 1) - 1;
      const day = parsed.d ?? 1;
      const date = new Date(Date.UTC(year, month, day));
      return date.toISOString().slice(0, 10);
    }
  }
  const text = String(value).trim();
  if (!text) return '';
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (match) {
    const [, mm, dd, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return '';
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeComparisonText(value: unknown) {
  return normalizeText(value).replace(/\s+/g, ' ').toUpperCase();
}

function parseMonthDayWithYear(value: unknown, year: number) {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/^(\d{1,2})[\/-]([A-Za-z]{3,9})$/) || text.match(/^([A-Za-z]{3,9})[\/-](\d{1,2})$/);
  if (!match) return '';
  const first = match[1];
  const second = match[2];
  const monthText = Number.isNaN(Number(first)) ? first : second;
  const dayText = Number.isNaN(Number(first)) ? second : first;
  const month = new Date(`${monthText} 1, ${year} 00:00:00 UTC`);
  if (Number.isNaN(month.getTime())) return '';
  const day = Number(dayText);
  if (!Number.isFinite(day)) return '';
  return new Date(Date.UTC(year, month.getUTCMonth(), day)).toISOString().slice(0, 10);
}

function parseDateSold(value: unknown, batchYear: number) {
  const normalized = normalizeDate(value);
  if (normalized) return normalized;
  const partial = parseMonthDayWithYear(value, batchYear);
  if (partial) return partial;
  const text = normalizeText(value);
  if (/^\d{1,2}-[A-Za-z]{3,9}$/.test(text) || /^[A-Za-z]{3,9}-\d{1,2}$/.test(text)) {
    return new Date(Date.UTC(batchYear, 0, 1)).toISOString().slice(0, 10);
  }
  return '';
}

function toSheetDate(sheetName: string, fallback: unknown) {
  return normalizeDate(fallback) || normalizeDate(sheetName.split('_')[0]) || new Date().toISOString().slice(0, 10);
}

function stableId(prefix: string, parts: Array<string | number | null | undefined>) {
  const hash = createHash('sha1');
  for (const part of parts) {
    hash.update(String(part ?? ''));
    hash.update('|');
  }
  return `${prefix}-${hash.digest('hex').slice(0, 18)}`;
}

export function parsePermitWorkbook(buffer: Buffer, sourceFileName: string, importRunId: string) {
  const workbook = read(buffer, { type: 'buffer', cellDates: true });
  const batches: PermitBatch[] = [];
  const packets: PermitPacket[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const batchCounts = new Map<string, number>();
  const safeSourceFileName = basename(sourceFileName || 'import.xlsx');
  const sourceFileFingerprint = createHash('sha1').update(buffer).digest('hex').slice(0, 18);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName] as Parameters<typeof utils.sheet_to_json>[0];
    const rows = utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
    const batchDate = toSheetDate(sheetName, rows[0]?.[1]);
    const batchYear = Number(batchDate.slice(0, 4)) || new Date().getFullYear();
    const checkNumber = normalizeText(rows[0]?.[7]);
    const nextBatchNumber = (batchCounts.get(batchDate) || 0) + 1;
    batchCounts.set(batchDate, nextBatchNumber);
    const batchId = stableId('batch', [sourceFileFingerprint, sheetName]);

    batches.push({
      id: batchId,
      batchDate,
      sheetName,
      sourceFileName: safeSourceFileName,
      sourceSheetName: sheetName,
      importedAt: now,
      importRunId,
      checkNumber,
      batchNumber: nextBatchNumber,
      status: 'Historical',
      notes: '',
      printedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    for (const row of rows.slice(3)) {
      const stockNumber = normalizeText(row?.[0]);
      const customerName = normalizeText(row?.[1]);
      const dateSold = parseDateSold(row?.[2], batchYear);
      const registrationCost = toNumber(row?.[4]);
      const collectedAmount = toNumber(row?.[6]);
      const owedAmount = toNumber(row?.[7]);
      const notes = normalizeText(row?.[8]);
      const packetKey = [
        batchDate,
        normalizeComparisonText(checkNumber),
        normalizeComparisonText(stockNumber),
        normalizeComparisonText(customerName),
        dateSold,
      ].join('|');

      if (!stockNumber && !customerName) {
        continue;
      }

      if (seen.has(packetKey)) continue;
      seen.add(packetKey);

      packets.push({
        id: stableId('packet', [batchDate, checkNumber, stockNumber, customerName, dateSold]),
        batchId,
        sourceFileName: safeSourceFileName,
        sourceSheetName: sheetName,
        importedAt: now,
        importRunId,
        stockNumber,
        customerName,
        dateSold,
        registrationCost,
        collectedAmount,
        owedAmount,
        notes,
        status: 'Imported',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return { batches, packets };
}

export function upsertImportedData(store: PermitStore, next: ReturnType<typeof parsePermitWorkbook>) {
  const batchById = new Map(store.batches.map((batch) => [batch.id, batch]));
  const packetKeys = new Set(store.packets.map((packet) => packet.id));
  const batches = [...store.batches];
  const packets = [...store.packets];
  let changed = false;

  for (const batch of next.batches) {
    if (batchById.has(batch.id)) continue;
    batches.push(batch);
    batchById.set(batch.id, batch);
    changed = true;
  }

  for (const packet of next.packets) {
    if (packetKeys.has(packet.id)) continue;
    packets.push(packet);
    packetKeys.add(packet.id);
    changed = true;
  }

  return { store: { ...store, batches, packets }, changed };
}
