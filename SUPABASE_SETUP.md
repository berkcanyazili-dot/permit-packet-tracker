# Supabase Setup

1. Create a new Supabase project for Caskinette Ford Permit Packet Tracker.
2. Run `supabase/migrations/0001_init.sql` against the project.
3. Set the following Vercel env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy the app and verify `/api/store` returns Supabase data.
5. Use `/import` to seed `JOHNN.xlsx` into the database.

Notes:
- The app uses `permit_batches` and `permit_packets`.
- `sheet_name` is preserved for traceability.
- Duplicate imports are blocked by stable ids derived from the workbook sheets and rows.
