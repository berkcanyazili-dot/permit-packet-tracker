import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/server/supabase';

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  let permitBatchesTable = false;
  let permitPacketsTable = false;
  let schemaError: string | null = null;

  if (supabaseConfigured) {
    try {
      const supabase = getSupabaseAdmin();
      const [batches, packets] = await Promise.all([
        supabase.from('permit_batches').select('id', { head: true, count: 'exact' }).limit(1),
        supabase.from('permit_packets').select('id', { head: true, count: 'exact' }).limit(1),
      ]);
      permitBatchesTable = !batches.error;
      permitPacketsTable = !packets.error;
      schemaError = batches.error?.message || packets.error?.message || null;
    } catch (error) {
      schemaError = error instanceof Error ? error.message : 'Unable to verify Supabase schema.';
    }
  }

  return NextResponse.json({
    supabaseConfigured,
    production: process.env.NODE_ENV === 'production',
    permitBatchesTable,
    permitPacketsTable,
    schemaReady: permitBatchesTable && permitPacketsTable,
    schemaError,
  });
}
