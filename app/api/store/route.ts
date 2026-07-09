import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server/supabase';
import { attachPackets } from '@/lib/permitSelectors';
import type { BatchStatus, PacketStatus, PermitBatch, PermitPacket, PermitStore } from '@/lib/types';

let localStore: PermitStore = { batches: [], packets: [], syncMode: 'local-fallback' };

type PermitBatchRow = {
  id: string;
  batch_date: string;
  sheet_name: string | null;
  source_file_name: string | null;
  source_sheet_name: string | null;
  imported_at: string | null;
  import_run_id: string | null;
  check_number: string | null;
  batch_number: number | null;
  status: string | null;
  notes: string | null;
  printed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PermitPacketRow = {
  id: string;
  batch_id: string;
  source_file_name: string | null;
  source_sheet_name: string | null;
  imported_at: string | null;
  import_run_id: string | null;
  stock_number: string | null;
  customer_name: string | null;
  date_sold: string | null;
  registration_cost: number | string | null;
  collected_amount: number | string | null;
  owed_amount: number | string | null;
  notes: string | null;
  status: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

function toNumber(value: number | string | null) {
  if (value === null || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isHistoricalBatchRow(row: PermitBatchRow) {
  // source_sheet_name is also used as the display sheet name for manually-created batches,
  // so only source_file_name / imported_at / import_run_id reliably indicate an Excel import.
  if (row.source_file_name || row.imported_at || row.import_run_id) return true;
  if (row.id.startsWith('batch-')) return true;
  if (row.status === 'Imported') return true;
  return row.batch_date < todayKey() && row.created_at.slice(0, 10) !== row.batch_date;
}

function isHistoricalPacketRow(row: PermitPacketRow, batchHistorical = false) {
  if (row.status === 'Historical' || row.status === 'Imported') return true;
  if (row.source_file_name || row.imported_at || row.import_run_id) return true;
  return batchHistorical;
}

function mapBatch(row: PermitBatchRow): PermitBatch {
  const historical = isHistoricalBatchRow(row);
  const sourceSheetName = row.source_sheet_name?.startsWith('manual:') ? '' : row.source_sheet_name || '';
  const status = historical ? 'Historical' : (row.status === 'Historical' || row.status === 'Imported') ? 'Draft' : row.status || 'Draft';
  return {
    id: row.id,
    batchDate: row.batch_date,
    sheetName: row.sheet_name || '',
    sourceFileName: row.source_file_name || '',
    sourceSheetName: historical ? sourceSheetName || row.sheet_name || '' : '',
    importedAt: row.imported_at,
    importRunId: row.import_run_id || '',
    checkNumber: row.check_number || '',
    batchNumber: row.batch_number || 1,
    status: status as BatchStatus,
    notes: row.notes || '',
    printedAt: row.printed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPacket(row: PermitPacketRow, historical = false): PermitPacket {
  return {
    id: row.id,
    batchId: row.batch_id,
    sourceFileName: row.source_file_name || '',
    sourceSheetName: row.source_sheet_name || '',
    importedAt: row.imported_at,
    importRunId: row.import_run_id || '',
    stockNumber: row.stock_number || '',
    customerName: row.customer_name || '',
    dateSold: row.date_sold || '',
    registrationCost: toNumber(row.registration_cost),
    collectedAmount: toNumber(row.collected_amount),
    owedAmount: toNumber(row.owed_amount),
    notes: row.notes || '',
    status: (historical ? 'Imported' : row.status || 'Not Started') as PacketStatus,
    sortOrder: row.sort_order ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function batchSourceSheetName(batch: PermitBatch) {
  if (batch.sourceSheetName) return batch.sourceSheetName;
  if (batch.sourceFileName || batch.importedAt || batch.importRunId || batch.status === 'Historical') return '';
  return `manual:${batch.id}`;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

const PAGE_SIZE = 1000;

async function fetchAllBatches() {
  const supabase = getSupabaseAdmin();
  const rows: PermitBatchRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from('permit_batches')
      .select('*')
      .order('batch_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) return { data: rows, error: result.error };
    rows.push(...((result.data ?? []) as PermitBatchRow[]));
    if ((result.data ?? []).length < PAGE_SIZE) return { data: rows, error: null };
  }
}

async function fetchAllPackets() {
  const supabase = getSupabaseAdmin();
  const rows: PermitPacketRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from('permit_packets')
      .select('*')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) return { data: rows, error: result.error };
    rows.push(...((result.data ?? []) as PermitPacketRow[]));
    if ((result.data ?? []).length < PAGE_SIZE) return { data: rows, error: null };
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ store: localStore });
  }

  const [batches, packets] = await Promise.all([
    fetchAllBatches(),
    fetchAllPackets(),
  ]);

  if (batches.error) return NextResponse.json({ error: batches.error.message }, { status: 500 });
  if (packets.error) return NextResponse.json({ error: packets.error.message }, { status: 500 });

  const mappedBatches = batches.data.map(mapBatch);
  const batchHistoricalById = new Map(mappedBatches.map((batch) => [batch.id, batch.status === 'Historical']));
  const mappedPackets = packets.data.map((row) => {
    const batchHistorical = batchHistoricalById.get(row.batch_id) ?? false;
    const historical = isHistoricalPacketRow(row, batchHistorical);
    return mapPacket(row, historical);
  });

  return NextResponse.json({
    store: {
      batches: mappedBatches,
      packets: mappedPackets,
      syncMode: 'supabase',
    },
  });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as PermitStore & { reconcilePacketBatchIds?: string[] };

  if (!isSupabaseConfigured()) {
    localStore = body;
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();
  const batches = uniqueById(body.batches).map((batch) => ({
    id: batch.id,
    batch_date: batch.batchDate,
    sheet_name: batch.sheetName,
    source_file_name: batch.sourceFileName || '',
    source_sheet_name: batchSourceSheetName(batch),
    imported_at: batch.importedAt || null,
    import_run_id: batch.importRunId || '',
    check_number: batch.checkNumber,
    batch_number: batch.batchNumber,
    status: batch.status,
    notes: batch.notes,
    printed_at: batch.printedAt,
    created_at: batch.createdAt,
    updated_at: batch.updatedAt,
  }));
  const packets = uniqueById(body.packets).map(({ id, batchId, stockNumber, customerName, dateSold, registrationCost, collectedAmount, owedAmount, notes, status, sortOrder, createdAt, updatedAt }) => ({
    id,
    batch_id: batchId,
    source_file_name: body.packets.find((item) => item.id === id)?.sourceFileName || '',
    source_sheet_name: body.packets.find((item) => item.id === id)?.sourceSheetName || '',
    imported_at: body.packets.find((item) => item.id === id)?.importedAt || null,
    import_run_id: body.packets.find((item) => item.id === id)?.importRunId || '',
    stock_number: stockNumber,
    customer_name: customerName,
    date_sold: dateSold || null,
    registration_cost: registrationCost,
    collected_amount: collectedAmount,
    owed_amount: owedAmount,
    notes,
    status,
    sort_order: sortOrder ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
  }));

  const batchIds = body.batches.map((item) => item.id);
  const packetIds = body.packets.map((item) => item.id);

  // IMPORTANT: this PUT is intentionally NON-destructive across batches.
  // Previously it deleted every batch/packet not present in the payload, which meant a
  // save from a client whose cache was incomplete (e.g. before loadStore() finished) would
  // silently wipe unrelated batches. Whole-batch deletion now goes exclusively through the
  // DELETE endpoint. Here we only reconcile packets WITHIN the batches included in the
  // payload, so removing a row from a batch you're editing still works, but batches that
  // aren't part of this request are never touched.
  const existingPackets = await supabase.from('permit_packets').select('id, batch_id');
  if (existingPackets.error) return NextResponse.json({ error: existingPackets.error.message }, { status: 500 });

  const payloadBatchIds = new Set(body.reconcilePacketBatchIds ?? []);
  const currentPacketIds = new Set(packetIds);
  const packetsToDelete = (existingPackets.data ?? [])
    .filter((row) => payloadBatchIds.has(row.batch_id) && !currentPacketIds.has(row.id))
    .map((row) => row.id);

  // Packets reference batches, so the parent rows must exist before packet upserts run.
  const batchResult = batches.length
    ? await supabase.from('permit_batches').upsert(batches, { onConflict: 'id' })
    : { error: null };
  if (batchResult.error) return NextResponse.json({ error: batchResult.error.message }, { status: 500 });

  const packetResult = packets.length
    ? await supabase.from('permit_packets').upsert(packets, { onConflict: 'id' })
    : { error: null };
  if (packetResult.error) return NextResponse.json({ error: packetResult.error.message }, { status: 500 });

  const deletePacketResult = packetsToDelete.length ? await supabase.from('permit_packets').delete().in('id', packetsToDelete) : { error: null };
  if (deletePacketResult.error) return NextResponse.json({ error: deletePacketResult.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, batchIds, packetIds, totalPackets: attachPackets(body).length });
}

export async function DELETE(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Local fallback does not support batch deletion.' }, { status: 400 });
  }

  const url = new URL(req.url);
  const batchId = url.searchParams.get('batchId');
  if (!batchId) {
    return NextResponse.json({ ok: false, error: 'batchId is required.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const packetDelete = await supabase.from('permit_packets').delete().eq('batch_id', batchId);
  if (packetDelete.error) return NextResponse.json({ ok: false, error: packetDelete.error.message }, { status: 500 });

  const batchDelete = await supabase.from('permit_batches').delete().eq('id', batchId);
  if (batchDelete.error) return NextResponse.json({ ok: false, error: batchDelete.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, batchId });
}
