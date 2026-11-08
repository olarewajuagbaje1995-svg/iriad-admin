-- Migration 006: Documents and calendar
-- Tables: documents, document_versions, calendar_events

-- 1. Documents (private storage buckets; signed URLs for download)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  category text,
  description text,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  linked_to_type text, -- project|task|report|announcement
  linked_to_id text,
  version integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Document versions
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  version integer not null,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Calendar events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('meeting','event','project_milestone','task_deadline','report_deadline','training','workshop')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  location text,
  participants jsonb default '[]'::jsonb, -- profile ids
  related_to_type text, -- project|task|report
  related_to_id text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_documents_org on public.documents(organisation_id);
create index if not exists idx_documents_owner on public.documents(owner_id);
create index if not exists idx_documents_linked on public.documents(linked_to_type, linked_to_id);
create index if not exists idx_document_versions_doc on public.document_versions(document_id);
create index if not exists idx_calendar_events_org on public.calendar_events(organisation_id);
create index if not exists idx_calendar_events_range on public.calendar_events(start_at, end_at);

-- Enable RLS
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.calendar_events enable row level security;

-- RLS: documents — org-scoped, permission-aware
create policy documents_select_own on public.documents
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (is_public = true or owner_id = auth.uid()
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('super_admin','staff_admin')
      ))
  );
create policy documents_manage_own on public.documents
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and owner_id = auth.uid()
  );
create policy documents_manage_admin on public.documents
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy document_versions_select_own on public.document_versions
  for select using (
    document_id in (select id from public.documents where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy document_versions_manage_own on public.document_versions
  for all using (
    document_id in (select id from public.documents where owner_id = auth.uid())
  )
  with check (
    document_id in (select id from public.documents where owner_id = auth.uid())
    and uploaded_by = auth.uid()
  );

-- RLS: calendar events — org-scoped
create policy calendar_events_select_own on public.calendar_events
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy calendar_events_manage_own on public.calendar_events
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and created_by = auth.uid()
  );
create policy calendar_events_manage_admin on public.calendar_events
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- 4. Storage buckets for private documents
-- The 'documents' bucket is private; downloads use signed URLs.
-- Create via SQL (run once) — also creatable through the Supabase dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB limit
  '{"application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain","text/markdown","image/png","image/jpeg","image/gif","image/webp","text/csv","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}'
) on conflict (id) do nothing;

-- Storage policies for the private documents bucket
create policy if not exists documents_storage_select_own on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
create policy if not exists documents_storage_insert_own on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
create policy if not exists documents_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );
