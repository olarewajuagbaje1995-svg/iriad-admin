-- Migration 007: Notifications and automated reporting
-- Tables: notifications, email_report_recipients, generated_reports, email_logs, automation_runs

-- 1. Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'attendance_opening','attendance_reminder','attendance_closed',
    'sign_out_opened','missing_checkout',
    'task_assigned','task_deadline','task_review_outcome',
    'report_deadline','report_approved','report_revision',
    'announcement','chat_message','meeting_reminder','project_milestone',
    'knowledge_processing_failure'
  )),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Email report recipients (configured by admin, not hardcoded)
create table if not exists public.email_report_recipients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  email text not null,
  name text,
  report_types text[] not null default '{}', -- daily|weekly|monthly|end_of_day
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Generated reports (metadata + secure file path)
create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  report_type text not null check (report_type in ('daily','weekly','monthly','end_of_day')),
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profiles(id) on delete set null,
  html_path text,
  pdf_path text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','partial')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

-- 4. Email logs
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  recipient text not null,
  subject text,
  provider_message_id text,
  status text not null check (status in ('sent','failed','retrying')),
  failure_reason text,
  sent_at timestamptz not null default now()
);

-- 5. Automation runs (n8n run records)
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete set null,
  workflow_name text not null,
  trigger text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  input jsonb default '{}'::jsonb,
  output jsonb default '{}'::jsonb,
  error text
);

-- Indexes
create index if not exists idx_notifications_org_recipient on public.notifications(organisation_id, recipient_id);
create index if not exists idx_notifications_recipient_unread on public.notifications(recipient_id, is_read);
create index if not exists idx_notifications_created on public.notifications(created_at);
create index if not exists idx_email_recipients_org on public.email_report_recipients(organisation_id);
create index if not exists idx_generated_reports_org on public.generated_reports(organisation_id);
create index if not exists idx_generated_reports_idempotency on public.generated_reports(idempotency_key);
create index if not exists idx_email_logs_sent on public.email_logs(sent_at);
create index if not exists idx_automation_runs_org on public.automation_runs(organisation_id);

-- Enable RLS
alter table public.notifications enable row level security;
alter table public.email_report_recipients enable row level security;
alter table public.generated_reports enable row level security;
alter table public.email_logs enable row level security;
alter table public.automation_runs enable row level security;

-- RLS
create policy notifications_select_own on public.notifications
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and recipient_id = auth.uid()
  );
create policy notifications_update_own on public.notifications
  for update using (
    recipient_id = auth.uid()
  )
  with check (recipient_id = auth.uid());
create policy notifications_insert_system on public.notifications
  for insert with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy email_report_recipients_select_own on public.email_report_recipients
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy email_report_recipients_manage_admin on public.email_report_recipients
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy generated_reports_select_own on public.generated_reports
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy generated_reports_manage_admin on public.generated_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy email_logs_select_own on public.email_logs
  for select using (
    organisation_id is null
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy automation_runs_select_own on public.automation_runs
  for select using (
    organisation_id is null
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
