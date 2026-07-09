drop index if exists public.permit_batches_source_unique_idx;

create unique index if not exists permit_batches_source_unique_idx
on public.permit_batches (organization_id, source_file_name, source_sheet_name)
where source_file_name <> '' or source_sheet_name <> '';
