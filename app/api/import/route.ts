import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { parsePermitWorkbook } from '@/lib/permitImport';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server/supabase';
import type { PermitBatch, PermitPacket, PermitStore } from '@/lib/types';

let localStore: PermitStore = { batches: [], packets: [], syncMode: 'local-fallback' };

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

type ImportSessionSummary = {
  files: FileImportSummary[];
  worksheetsParsed: number;
  batchesImported: number;
  batchesSkipped: number;
  packetsImported: number;
  packetsSkipped: number;
  rowsWithErrors: number;
  errors: string[];
};

function createEmptyFileSummary(sourceFileName: string): FileImportSummary {
  return {
    sourceFileName,
    worksheetsParsed: 0,
    batchesCreated: 0,
    batchesSkippedDuplicates: 0,
    packetsCreated: 0,
    packetsSkippedDuplicates: 0,
    rowsWithErrors: 0,
    emptySheetsSkipped: 0,
    errors: [],
  };
}

function getUploadedFiles(form: FormData) {
  const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 0) return files;
  const single = form.get('file');
  return single instanceof File && single.size > 0 ? [single] : [];
}

function getSourcePath(form: FormData) {
  const source = form.get('source');
  return typeof source === 'string' && source.trim() ? source.trim() : null;
}

function processParsedWorkbook(
  parsed: ReturnType<typeof parsePermitWorkbook>,
  sourceFileName: string,
  existingBatchIds: Set<string>,
  existingPacketIds: Set<string>,
  sessionBatchIds: Set<string>,
  sessionPacketIds: Set<string>,
) {
  const summary = createEmptyFileSummary(sourceFileName);
  summary.worksheetsParsed = parsed.batches.length;
  const packetsByBatch = new Map<string, PermitPacket[]>();
  for (const packet of parsed.packets) {
    const list = packetsByBatch.get(packet.batchId) || [];
    list.push(packet);
    packetsByBatch.set(packet.batchId, list);
  }

  const batchesToInsert: PermitBatch[] = [];
  const packetsToInsert: PermitPacket[] = [];

  for (const batch of parsed.batches) {
    const sheetPackets = packetsByBatch.get(batch.id) || [];
    if (sheetPackets.length === 0) {
      summary.emptySheetsSkipped += 1;
      continue;
    }

    const uniquePackets = sheetPackets.filter((packet) => !existingPacketIds.has(packet.id) && !sessionPacketIds.has(packet.id));
    const duplicateCount = sheetPackets.length - uniquePackets.length;
    summary.packetsSkippedDuplicates += duplicateCount;

    const batchExists = existingBatchIds.has(batch.id) || sessionBatchIds.has(batch.id);
    if (!batchExists && uniquePackets.length > 0) {
      batchesToInsert.push(batch);
      sessionBatchIds.add(batch.id);
      summary.batchesCreated += 1;
    } else {
      summary.batchesSkippedDuplicates += 1;
    }

    if (uniquePackets.length > 0) {
      packetsToInsert.push(...uniquePackets);
      uniquePackets.forEach((packet) => sessionPacketIds.add(packet.id));
      summary.packetsCreated += uniquePackets.length;
    }
  }

  return { summary, batchesToInsert, packetsToInsert };
}

async function persistToSupabase(batches: PermitBatch[], packets: PermitPacket[]) {
  const supabase = getSupabaseAdmin();
  const [batchResult, packetResult] = await Promise.all([
    batches.length
      ? supabase.from('permit_batches').upsert(
          batches.map(({ id, batchDate, sheetName, sourceFileName, sourceSheetName, importedAt, importRunId, checkNumber, batchNumber, status, notes, printedAt, createdAt, updatedAt }) => ({
            id,
            batch_date: batchDate,
            sheet_name: sheetName,
            source_file_name: sourceFileName,
            source_sheet_name: sourceSheetName,
            imported_at: importedAt,
            import_run_id: importRunId,
            check_number: checkNumber,
            batch_number: batchNumber,
            status,
            notes,
            printed_at: printedAt,
            created_at: createdAt,
            updated_at: updatedAt,
          })),
          { onConflict: 'id' },
        )
      : Promise.resolve({ error: null }),
    packets.length
      ? supabase.from('permit_packets').upsert(
          packets.map(({ id, batchId, sourceFileName, sourceSheetName, importedAt, importRunId, stockNumber, customerName, dateSold, registrationCost, collectedAmount, owedAmount, notes, status, createdAt, updatedAt }) => ({
            id,
            batch_id: batchId,
            source_file_name: sourceFileName,
            source_sheet_name: sourceSheetName,
            imported_at: importedAt,
            import_run_id: importRunId,
            stock_number: stockNumber,
            customer_name: customerName,
            date_sold: dateSold || null,
            registration_cost: registrationCost,
            collected_amount: collectedAmount,
            owed_amount: owedAmount,
            notes,
            status,
            created_at: createdAt,
            updated_at: updatedAt,
          })),
          { onConflict: 'id' },
        )
      : Promise.resolve({ error: null }),
  ]);

  return { batchResult, packetResult };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const importRunId = randomUUID();
  const files = getUploadedFiles(form);
  const sourcePath = getSourcePath(form);

  if (!files.length && !sourcePath) {
    return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 });
  }

  const importSources = files.length ? files : [{ name: basename(sourcePath!), arrayBuffer: async () => readFile(sourcePath!).then((buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) } as File];

  const sessionSummary: ImportSessionSummary = {
    files: [],
    worksheetsParsed: 0,
    batchesImported: 0,
    batchesSkipped: 0,
    packetsImported: 0,
    packetsSkipped: 0,
    rowsWithErrors: 0,
    errors: [],
  };

  const existingBatchIds = new Set<string>();
  const existingPacketIds = new Set<string>();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const [batchRows, packetRows] = await Promise.all([
      supabase.from('permit_batches').select('id'),
      supabase.from('permit_packets').select('id'),
    ]);
    if (batchRows.error) {
      return NextResponse.json({ ok: false, syncMode: 'supabase', summary: { ...sessionSummary, errors: [`permit_batches existing check: ${batchRows.error.message}`] } }, { status: 500 });
    }
    if (packetRows.error) {
      return NextResponse.json({ ok: false, syncMode: 'supabase', summary: { ...sessionSummary, errors: [`permit_packets existing check: ${packetRows.error.message}`] } }, { status: 500 });
    }
    (batchRows.data ?? []).forEach((row) => existingBatchIds.add(row.id));
    (packetRows.data ?? []).forEach((row) => existingPacketIds.add(row.id));
  } else {
    localStore.batches.forEach((batch) => existingBatchIds.add(batch.id));
    localStore.packets.forEach((packet) => existingPacketIds.add(packet.id));
  }

  const sessionBatchIds = new Set<string>();
  const sessionPacketIds = new Set<string>();
  let anyErrors = false;

  for (const file of importSources) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parsePermitWorkbook(buffer, file.name, importRunId);
    const { summary, batchesToInsert, packetsToInsert } = processParsedWorkbook(
      parsed,
      file.name,
      existingBatchIds,
      existingPacketIds,
      sessionBatchIds,
      sessionPacketIds,
    );

    sessionSummary.worksheetsParsed += summary.worksheetsParsed;
    sessionSummary.batchesImported += summary.batchesCreated;
    sessionSummary.batchesSkipped += summary.batchesSkippedDuplicates + summary.emptySheetsSkipped;
    sessionSummary.packetsImported += summary.packetsCreated;
    sessionSummary.packetsSkipped += summary.packetsSkippedDuplicates;
    sessionSummary.rowsWithErrors += summary.rowsWithErrors;
    sessionSummary.files.push(summary);

    if (!isSupabaseConfigured()) {
      localStore = {
        ...localStore,
        batches: [...localStore.batches, ...batchesToInsert],
        packets: [...localStore.packets, ...packetsToInsert],
        syncMode: 'local-fallback',
      };
      batchesToInsert.forEach((batch) => existingBatchIds.add(batch.id));
      packetsToInsert.forEach((packet) => existingPacketIds.add(packet.id));
      continue;
    }

    const { batchResult, packetResult } = await persistToSupabase(batchesToInsert, packetsToInsert);
    if (batchResult.error) {
      summary.errors.push(`permit_batches: ${batchResult.error.message}`);
      sessionSummary.errors.push(`permit_batches (${file.name}): ${batchResult.error.message}`);
      anyErrors = true;
    }
    if (packetResult.error) {
      summary.errors.push(`permit_packets: ${packetResult.error.message}`);
      sessionSummary.errors.push(`permit_packets (${file.name}): ${packetResult.error.message}`);
      anyErrors = true;
    }

    batchesToInsert.forEach((batch) => existingBatchIds.add(batch.id));
    packetsToInsert.forEach((packet) => existingPacketIds.add(packet.id));
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const [savedBatches, savedPackets] = await Promise.all([
      supabase.from('permit_batches').select('id', { count: 'exact', head: true }),
      supabase.from('permit_packets').select('id', { count: 'exact', head: true }),
    ]);
    if (savedBatches.error) {
      sessionSummary.errors.push(`verify permit_batches: ${savedBatches.error.message}`);
      anyErrors = true;
    }
    if (savedPackets.error) {
      sessionSummary.errors.push(`verify permit_packets: ${savedPackets.error.message}`);
      anyErrors = true;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[permit-import]', {
        importRunId,
        files: sessionSummary.files.map((item) => ({
          sourceFileName: item.sourceFileName,
          worksheetsParsed: item.worksheetsParsed,
          batchesCreated: item.batchesCreated,
          batchesSkippedDuplicates: item.batchesSkippedDuplicates,
          packetsCreated: item.packetsCreated,
          packetsSkippedDuplicates: item.packetsSkippedDuplicates,
          emptySheetsSkipped: item.emptySheetsSkipped,
        })),
        batchesVerified: savedBatches.count,
        packetsVerified: savedPackets.count,
      });
    }
  }

  const responseSummary = sessionSummary;
  const payload = {
    ok: !anyErrors,
    syncMode: isSupabaseConfigured() ? 'supabase' : 'local-fallback',
    importRunId,
    summary: responseSummary,
    store: !isSupabaseConfigured() ? localStore : undefined,
  };

  if (anyErrors) {
    return NextResponse.json(payload, { status: 500 });
  }

  return NextResponse.json(payload);
}
