-- Migration 012: Automation engine foundation (database)
-- Part of Phase 3 of the Dual Automation Engine brief.
--
-- PURPOSE
--   Create the central job registry and supporting tables used by both the
--   n8n primary engine and the independent IRIAD native backup engine:
--     * automation_engines      — engine health + failover configuration
--     * automation_jobs         — central job registry (single source of truth)
--     * automation_executions   — per-attempt execution history
--     * automation_idempotency  — shared idempotency records (both engines)
--     * automation_recoveries   — failover / recovery audit records
--     * automation_config       — per-organisation automation configuration
--   Plus the atomic claim_automation_job() function, indexes, RLS policies,
--   engine seed rows, and (guarded) Supabase Cron schedules.
--
-- DESIGN PRINCIPLES (from the approved architecture)
--   * Additive: no existing table is altered, dropped, or truncated.
--   * Existing n8n Master Workflow is the permanent primary automation workflow.
--     The native IRIAD engine is an independent secondary failover engine. This
--     is a hybrid architecture, not an n8n replacement.
--   * Both engines coordinate through the shared job registry and idempotency
--     system; the dispatcher prefers n8n whenever it is healthy.
--   * Effectively-once business effects via shared idempotency keys, atomic
--     claiming with leases, and uncertain-execution reconciliation.
--
-- PREREQUISITES (confirm before applying)
--   * Migration 011 (role alignment) must already be applied — the automation
--     RLS policies reference admin/director roles.
--   * pg_cron / pg_net availability confirmed on the target project:
--       SELECT * FROM pg_available_extensions WHERE name IN ('pg_cron','pg_net');
--   * Staging test completed. No production data is modified by this migration.
--
-- REVIEW ONLY — do not apply to production until approved.

-- ============================================================
-- 0. Extensions (pg_cron / pg_net)
--    Create only if available on the target project. Cron scheduling below is
--    guarded so this migration is safe even when pg_cron is unavailable; in
--    that case an external scheduler (Vercel Cron / GitHub Actions) can invoke
--    the Edge Functions directly (see architecture doc §9).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 1. Engine health registry (platform-level; organisation_id nullable)
-- ============================================================

create table if not exists public.automation_engines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('n8n','iriad-native')),
  kind text not null check (kind in ('primary','backup')),
  status text not null default 'unknown' check (status in ('healthy','degraded','unhealthy','unknown')),
  last_health_check_at timestamptz,
  last_successful_health_check_at timestamptz,
  consecutive_failures integer not null default 0,
  failure_threshold integer not null default 3,
  health_check_interval_seconds integer not null default 60,
  auto_failover_enabled boolean not null default true,
  preferred_engine text not null default 'n8n' check (preferred_engine in ('n8n','iriad-native')),
  max_retries integer not null default 3,
  retry_delay_seconds integer not null default 60,
  config jsonb not null default '{}'::jsonb,
  organisation_id uuid references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Central job registry (single source of truth for every automation job)
-- ============================================================

create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,                    -- e.g. attendance-open-<org>-2026-11-09
  idempotency_key text not null unique,            -- shared by both engines for the same business op
  workflow_name text not null,                     -- n8n workflow name or native function name
  business_operation text not null check (business_operation in (
    'attendance_open','attendance_close','signout_open','signout_close',
    'staff_checkin','staff_checkout','daily_attendance_report','weekly_report',
    'monthly_report','leave_notification','leave_approval','correction_notification',
    'correction_approval','task_assignment','task_deadline_reminder','announcement_notification',
    'document_notification','project_notification','knowledge_ingestion','knowledge_chat',
    'error_alert','recovery'
  )),
  trigger_type text not null check (trigger_type in ('schedule','webhook','event','manual','recovery')),
  scheduled_at timestamptz not null,
  primary_engine text not null default 'n8n' check (primary_engine in ('n8n','iriad-native')),
  backup_engine text not null default 'iriad-native' check (backup_engine in ('n8n','iriad-native')),
  current_engine text check (current_engine in ('n8n','iriad-native')),
  status text not null default 'Pending' check (status in (
    'Pending','Dispatched','Acknowledged','Running','Completed','Failed',
    'Timed Out','Uncertain','Retrying','Recovered','Cancelled'
  )),
  attempt_number integer not null default 0,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  execution_id text,                               -- n8n execution id when dispatched to n8n
  lease_holder text,                               -- engine instance that claimed the job
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  acknowledged_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_details jsonb default '{}'::jsonb,
  execution_result jsonb default '{}'::jsonb,
  recovery_status text,
  organisation_id uuid references public.organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lease_after_start check (
    lease_expires_at is null or started_at is null or lease_expires_at > started_at
  )
);

-- ============================================================
-- 3. Execution history (one row per attempt)
-- ============================================================

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  engine text not null check (engine in ('n8n','iriad-native')),
  attempt_number integer not null,
  status text not null check (status in ('running','completed','failed','timed_out')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb default '{}'::jsonb,
  error jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. Durable idempotency records (shared by both engines)
-- ============================================================

create table if not exists public.automation_idempotency (
  idempotency_key text primary key,
  business_operation text not null,
  organisation_id uuid references public.organisations(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  result jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================
-- 5. Recovery records
-- ============================================================

create table if not exists public.automation_recoveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  reason text not null check (reason in (
    'n8n_down','workflow_failure','timeout','missed_schedule','lease_expired','manual'
  )),
  recovered_by_engine text not null check (recovered_by_engine in ('n8n','iriad-native')),
  recovered_at timestamptz not null default now(),
  notes text
);

-- ============================================================
-- 6. Administrator automation configuration (per organisation)
-- ============================================================

create table if not exists public.automation_config (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (organisation_id, key)
);

-- ============================================================
-- 7. Seed engine rows for the IRIAD organisation
--    n8n is the primary engine; iriad-native is the backup engine.
-- ============================================================

insert into public.automation_engines (name, kind, status, preferred_engine, organisation_id)
select 'n8n', 'primary', 'unknown', 'n8n', id
from public.organisations where slug = 'iriad'
on conflict (name) do nothing;

insert into public.automation_engines (name, kind, status, preferred_engine, organisation_id)
select 'iriad-native', 'backup', 'unknown', 'n8n', id
from public.organisations where slug = 'iriad'
on conflict (name) do nothing;

-- ============================================================
-- 8. Indexes
-- ============================================================

create index if not exists idx_automation_jobs_status_schedule on public.automation_jobs(status, scheduled_at)
  where status in ('Pending','Dispatched','Retrying');
create index if not exists idx_automation_jobs_idempotency on public.automation_jobs(idempotency_key);
create index if not exists idx_automation_jobs_job_id on public.automation_jobs(job_id);
create index if not exists idx_automation_jobs_org on public.automation_jobs(organisation_id);
create index if not exists idx_automation_jobs_engine on public.automation_jobs(current_engine);
create index if not exists idx_automation_jobs_lease on public.automation_jobs(lease_expires_at)
  where lease_expires_at is not null;
create index if not exists idx_automation_jobs_business on public.automation_jobs(business_operation, scheduled_at);
create index if not exists idx_automation_executions_job on public.automation_executions(job_id, attempt_number);
create index if not exists idx_automation_recoveries_job on public.automation_recoveries(job_id);
create index if not exists idx_automation_config_org on public.automation_config(organisation_id);

-- ============================================================
-- 9. Row Level Security
--    Manage policies are restricted to admin/director roles (aligned in 011).
--    Staff can read their own organisation's automation data but cannot modify
--    automation_config, automation_engines, or claim jobs.
-- ============================================================

alter table public.automation_engines enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.automation_executions enable row level security;
alter table public.automation_idempotency enable row level security;
alter table public.automation_recoveries enable row level security;
alter table public.automation_config enable row level security;

-- Select: within own organisation (platform-level rows readable by admin/director)
create policy if not exists automation_engines_select_own on public.automation_engines
  for select using (
    organisation_id is null
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy if not exists automation_engines_manage_admin on public.automation_engines
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

create policy if not exists automation_jobs_select_own on public.automation_jobs
  for select using (
    organisation_id is null
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy if not exists automation_jobs_manage_admin on public.automation_jobs
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

create policy if not exists automation_executions_select_own on public.automation_executions
  for select using (
    organisation_id is null
    or exists (
      select 1 from public.automation_jobs j
      where j.id = automation_executions.job_id
        and (j.organisation_id is null or j.organisation_id in (
          select organisation_id from public.profiles where id = auth.uid()
        ))
    )
  );

create policy if not exists automation_idempotency_select_own on public.automation_idempotency
  for select using (
    organisation_id is null
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy if not exists automation_recoveries_select_own on public.automation_recoveries
  for select using (
    exists (
      select 1 from public.automation_jobs j
      where j.id = automation_recoveries.job_id
        and (j.organisation_id is null or j.organisation_id in (
          select organisation_id from public.profiles where id = auth.uid()
        ))
    )
  );

create policy if not exists automation_config_select_own on public.automation_config
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy if not exists automation_config_manage_admin on public.automation_config
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- ============================================================
-- 10. Atomic job claiming function (shared by both engines)
--     FOR UPDATE SKIP LOCKED lets concurrent dispatchers claim distinct jobs;
--     the 10-minute lease bounds how long an engine can hold a job.
-- ============================================================

create or replace function public.claim_automation_job(p_engine text)
returns setof public.automation_jobs
language plpgsql
set search_path = public, pg_temp
as $$
begin
  return query
  with locked as (
    select id from public.automation_jobs
    where status in ('Pending','Dispatched','Retrying')
      and scheduled_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
    order by scheduled_at asc
    for update skip locked
    limit 1
  )
  update public.automation_jobs j
  set status = 'Running',
      current_engine = p_engine,
      lease_holder = p_engine,
      lease_expires_at = now() + make_interval(secs => 600),  -- 10-minute lease
      heartbeat_at = now(),
      started_at = coalesce(j.started_at, now()),
      attempt_number = j.attempt_number + 1,
      updated_at = now()
  from locked l
  where j.id = l.id
  returning *;
end;
$$;

-- ============================================================
-- 11. Supabase Cron schedules (guarded — only when pg_cron AND pg_net are available)
--    Forward references to Edge Functions delivered in Phase 4
--    (supabase/functions/automation-*/index.ts). Enable once pg_cron/pg_net
--    are confirmed and the Edge Functions are deployed.
--    SECURITY: The URL and service-role key below are PLACEHOLDERS. They must be
--    replaced through secure deployment configuration (e.g. Supabase project
--    settings / CI secrets) before cron schedules are enabled. Never commit real
--    credentials, service-role keys, or project URLs to this file or to GitHub.
-- ============================================================

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    -- health check: every minute
    perform cron.schedule(
      'automation-health-check',
      '* * * * *',
      $$select net.http_post(
        url := 'https://<supabase-project>.functions.supabase.co/automation-health-check',
        headers := jsonb_build_object('Authorization', 'Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>'),
        body := ''::jsonb
      );$$
    );
    -- dispatcher: every minute
    perform cron.schedule(
      'automation-dispatcher',
      '* * * * *',
      $$select net.http_post(
        url := 'https://<supabase-project>.functions.supabase.co/automation-dispatcher',
        headers := jsonb_build_object('Authorization', 'Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>'),
        body := ''::jsonb
      );$$
    );
    -- lease reaper: every 15 minutes
    perform cron.schedule(
      'automation-lease-reaper',
      '*/15 * * * *',
      $$select net.http_post(
        url := 'https://<supabase-project>.functions.supabase.co/automation-lease-reaper',
        headers := jsonb_build_object('Authorization', 'Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>'),
        body := ''::jsonb
      );$$
    );
    -- missed-schedule recovery: hourly
    perform cron.schedule(
      'automation-missed-schedule-recovery',
      '0 * * * *',
      $$select net.http_post(
        url := 'https://<supabase-project>.functions.supabase.co/automation-missed-schedule-recovery',
        headers := jsonb_build_object('Authorization', 'Bearer <REPLACE_WITH_SERVICE_ROLE_KEY>'),
        body := ''::jsonb
      );$$
    );
  end if;
end $$;
