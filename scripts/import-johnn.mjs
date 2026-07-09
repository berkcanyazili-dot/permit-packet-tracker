import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parsePermitWorkbook } from '../lib/permitImport.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workbookPaths = process.argv.slice(2);
const runId = randomUUID();
const paths = workbookPaths.length > 0 ? workbookPaths : ['/Users/berkcanyazili/Downloads/JOHNN.xlsx'];
const parsedWorkbooks = [];

for (const workbookPath of paths) {
  const buffer = await fs.readFile(workbookPath);
  parsedWorkbooks.push({
    path: workbookPath,
    parsed: parsePermitWorkbook(buffer, path.basename(workbookPath), runId),
  });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.log(JSON.stringify({
    importRunId: runId,
    files: parsedWorkbooks.map(({ path: workbookPath, parsed }) => ({
      sourceFileName: path.basename(workbookPath),
      batches: parsed.batches.length,
      packets: parsed.packets.length,
    })),
    batches: parsedWorkbooks.reduce((sum, { parsed }) => sum + parsed.batches.length, 0),
    packets: parsedWorkbooks.reduce((sum, { parsed }) => sum + parsed.packets.length, 0),
  }, null, 2));
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const batches = parsedWorkbooks.flatMap(({ parsed }) =>
  parsed.batches.map(({ id, batchDate, sheetName, sourceFileName, sourceSheetName, importedAt, importRunId, checkNumber, batchNumber, status, notes, printedAt, createdAt, updatedAt }) => ({
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
);

const packets = parsedWorkbooks.flatMap(({ parsed }) =>
  parsed.packets.map(({ id, batchId, sourceFileName, sourceSheetName, importedAt, importRunId, stockNumber, customerName, dateSold, registrationCost, collectedAmount, owedAmount, notes, status, createdAt, updatedAt }) => ({
    id,
    batch_id: batchId,
    source_file_name: sourceFileName,
    source_sheet_name: sourceSheetName,
    imported_at: importedAt,
    import_run_id: importRunId,
    stock_number: stockNumber,
    customer_name: customerName,
    date_sold: dateSold,
    registration_cost: registrationCost,
    collected_amount: collectedAmount,
    owed_amount: owedAmount,
    notes,
    status,
    created_at: createdAt,
    updated_at: updatedAt,
  })),
);

await supabase.from('permit_batches').upsert(batches, { onConflict: 'id' });
await supabase.from('permit_packets').upsert(packets, { onConflict: 'id' });
console.log(JSON.stringify({
  importRunId: runId,
  files: parsedWorkbooks.map(({ path: workbookPath, parsed }) => ({
    sourceFileName: path.basename(workbookPath),
    batches: parsed.batches.length,
    packets: parsed.packets.length,
  })),
  batches: batches.length,
  packets: packets.length,
}, null, 2));
