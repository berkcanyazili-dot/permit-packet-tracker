import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parsePermitWorkbook, normalizeDate, normalizeText } from '../lib/permitImport.ts';

const defaultPaths = [
  '/Users/berkcanyazili/Downloads/JOHNN.xlsx',
  '/Users/berkcanyazili/Downloads/BOOK2 for john.xlsx',
];

const workbookPaths = process.argv.slice(2);
const paths = workbookPaths.length > 0 ? workbookPaths : defaultPaths;
const runId = randomUUID();

function normalizeKey(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toUpperCase();
}

function loadDotEnvLocal(filePath = '.env.local') {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  if (!fsSync.existsSync(filePath)) return;
  const content = fsSync.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('export ')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function batchMatchKey(sourceFileName, sourceSheetName, batchDate, checkNumber) {
  return [normalizeKey(sourceFileName), normalizeKey(sourceSheetName), normalizeDate(batchDate), normalizeKey(checkNumber)].join('|');
}

function mapBatches(rows) {
  const map = new Map();
  for (const row of rows || []) {
    map.set(batchMatchKey(row.source_file_name, row.source_sheet_name || row.sheet_name, row.batch_date, row.check_number), row);
  }
  return map;
}

loadDotEnvLocal();
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to repair imports.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const [existingBatchesRes, existingPacketsRes] = await Promise.all([
  supabase.from('permit_batches').select('*'),
  supabase.from('permit_packets').select('*'),
]);

if (existingBatchesRes.error) throw new Error(existingBatchesRes.error.message);
if (existingPacketsRes.error) throw new Error(existingPacketsRes.error.message);

const existingBatches = existingBatchesRes.data ?? [];
const existingPackets = existingPacketsRes.data ?? [];
const batchesByKey = mapBatches(existingBatches);
const packetIds = new Set(existingPackets.map((row) => row.id));

const summary = [];

for (const workbookPath of paths) {
  const buffer = await fs.readFile(workbookPath);
  const sourceFileName = path.basename(workbookPath);
  const parsed = parsePermitWorkbook(buffer, sourceFileName, runId);

  let batchesUpdated = 0;
  let batchesCreated = 0;
  let packetsCreated = 0;
  let packetsUpdated = 0;
  let rowsSkipped = 0;
  const sampleBatches = [];

  for (const batch of parsed.batches) {
    const sheetPackets = parsed.packets.filter((packet) => packet.batchId === batch.id);
    if (sheetPackets.length === 0) {
      rowsSkipped += 1;
      continue;
    }

    const batchKey = batchMatchKey(sourceFileName, batch.sheetName, batch.batchDate, batch.checkNumber);
    const existingBatch = batchesByKey.get(batchKey) || existingBatches.find((row) => normalizeDate(row.batch_date) === normalizeDate(batch.batchDate) && normalizeKey(row.check_number) === normalizeKey(batch.checkNumber) && (normalizeKey(row.sheet_name) === normalizeKey(batch.sheetName) || normalizeKey(row.source_sheet_name) === normalizeKey(batch.sheetName)));
    const batchId = existingBatch?.id || batch.id;
    const nextBatch = {
      ...batch,
      id: batchId,
      sourceFileName,
      sourceSheetName: batch.sheetName,
      importedAt: batch.importedAt,
      importRunId: batch.importRunId,
      status: 'Historical',
    };

    const { error: batchError } = await supabase.from('permit_batches').upsert({
      id: nextBatch.id,
      batch_date: nextBatch.batchDate,
      sheet_name: nextBatch.sheetName,
      source_file_name: nextBatch.sourceFileName,
      source_sheet_name: nextBatch.sourceSheetName,
      imported_at: nextBatch.importedAt,
      import_run_id: nextBatch.importRunId,
      check_number: nextBatch.checkNumber,
      batch_number: nextBatch.batchNumber,
      status: nextBatch.status,
      notes: nextBatch.notes,
      printed_at: nextBatch.printedAt,
      created_at: nextBatch.createdAt,
      updated_at: nextBatch.updatedAt,
    }, { onConflict: 'id' });

    if (batchError) throw new Error(`Batch ${batch.sheetName}: ${batchError.message}`);

    if (existingBatch) {
      batchesUpdated += 1;
    } else {
      batchesCreated += 1;
      existingBatches.push({ id: batchId, batch_date: batch.batchDate, sheet_name: batch.sheetName, source_file_name: sourceFileName, source_sheet_name: batch.sheetName, imported_at: batch.importedAt, import_run_id: batch.importRunId, check_number: batch.checkNumber, batch_number: batch.batchNumber, status: 'Historical', notes: batch.notes, printed_at: batch.printedAt, created_at: batch.createdAt, updated_at: batch.updatedAt });
      batchesByKey.set(batchKey, existingBatches[existingBatches.length - 1]);
    }

    for (const packet of sheetPackets) {
      const id = packet.id;
      const exists = packetIds.has(id);
      const { error: packetError } = await supabase.from('permit_packets').upsert({
        id,
        batch_id: batchId,
        source_file_name: sourceFileName,
        source_sheet_name: packet.sourceSheetName,
        imported_at: packet.importedAt,
        import_run_id: packet.importRunId,
        stock_number: packet.stockNumber,
        customer_name: packet.customerName,
        date_sold: packet.dateSold || null,
        registration_cost: packet.registrationCost,
        collected_amount: packet.collectedAmount,
        owed_amount: packet.owedAmount,
        notes: packet.notes,
        status: packet.status,
        created_at: packet.createdAt,
        updated_at: packet.updatedAt,
      }, { onConflict: 'id' });
      if (packetError) throw new Error(`Packet ${packet.stockNumber || packet.customerName}: ${packetError.message}`);
      if (exists) packetsUpdated += 1;
      else {
        packetsCreated += 1;
        packetIds.add(id);
      }
    }

    if (sampleBatches.length < 5) {
      sampleBatches.push({ batchDate: batch.batchDate, checkNumber: batch.checkNumber, packets: sheetPackets.length, sheetName: batch.sheetName });
    }
  }

  summary.push({
    file: sourceFileName,
    worksheetsProcessed: parsed.batches.length,
    batchesCreated,
    batchesUpdated,
    packetsCreated,
    packetsUpdated,
    rowsSkipped,
    sampleBatches,
  });
}

console.log(JSON.stringify({ repairRunId: runId, summary }, null, 2));
