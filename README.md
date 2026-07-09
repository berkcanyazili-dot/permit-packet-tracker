# Caskinette Ford Permit Packet Tracker

Separate dealership SaaS app for receptionist DMV permit packets.

## Pages

- `/auth/signin`
- `/dashboard`
- `/batches/new`
- `/batches`
- `/search`
- `/print`
- `/reports`
- `/import`

## Import

- One-time seed script: `npm run import:johnn -- /Users/berkcanyazili/Downloads/JOHNN.xlsx`
- Upload import: use `/import`

## Supabase

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for migration and env vars.

## Production setup

1. Create a Supabase project for this app.
2. Run the SQL migration in `supabase/migrations/0001_init.sql`.
3. Add these Vercel env vars to the `permit-packet-tracker` project:
   - `PERMIT_LOGIN_EMAIL`
   - `PERMIT_LOGIN_PASSWORD`
   - `PERMIT_MANAGER_NAME`
   - `PERMIT_MANAGER_ROLE`
   - `NEXT_PUBLIC_DEALERSHIP_NAME`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy the Vercel project after saving env vars.
5. Confirm Settings / Import shows `Database Connected`.
6. Run the workbook import again and verify batches, packets, search, and reports persist after refresh.

If the app shows `Local-only mode: data will not sync across devices. Supabase is not connected.`, production Supabase is still missing or misconfigured.
