-- Migration 013: Staff provisioning audit log
-- Creates staff_audit_log table for auditing account creation and role changes
-- Supports the staff-provision Edge Function (supabase/functions/staff-provision/index.ts)
--
-- REVIEW ONLY — do not apply to production until approved and staged-tested.
-- Migration 011 (role alignment) should be applied before or alongside this
-- migration so the profiles.role check constraint accepts 'admin'/'director'/'staff'.

-- ============================================================
-- 1. staff_audit_log table
-- ============================================================

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'role_changed', 'deactivated', 'reactivated', 'deleted')),
  old_value text,
  new_value text,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

create index if not exists idx_staff_audit_log_staff on public.staff_audit_log(staff_id);
create index if not exists idx_staff_audit_log_org on public.staff_audit_log(organisation_id);
create index if not exists idx_staff_audit_log_created on public.staff_audit_log(created_at);

-- ============================================================
-- 3. Row Level Security
-- ============================================================

alter table public.staff_audit_log enable row level security;

-- RLS: read within own organisation
create policy staff_audit_log_select_own on public.staff_audit_log
  for select using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

-- RLS: insert allowed for admin/director within own organisation
create policy staff_audit_log_insert_own on public.staff_audit_log
  for insert with check (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );
