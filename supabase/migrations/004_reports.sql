-- Migration 004: Weekly and monthly reporting
-- Tables: reporting_periods, weekly_reports, monthly_reports, report_reviews, report_schedules

-- 1. Reporting periods (admin-defined, reproducible due dates, Africa/Lagos)
create table if not exists public.reporting_periods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  period_type text not null check (period_type in ('weekly','monthly')),
  label text not null,
  start_date date not null,
  end_date date not null,
  due_date date not null,
  deadline_rule text, -- e.g. 'Friday', 'Last working day of month'
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Weekly reports
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reporting_period_id uuid references public.reporting_periods(id) on delete set null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  reporting_week_start date not null,
  activities_carried_out text,
  tasks_completed text,
  meetings_attended text,
  achievements_outcomes text,
  challenges text,
  outstanding_activities text,
  next_week_plan text,
  supporting_documents jsonb default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','revision_requested')),
  submitted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, staff_id, reporting_week_start)
);

-- 3. Monthly reports
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  reporting_period_id uuid references public.reporting_periods(id) on delete set null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  reporting_month date not null, -- first day of month
  major_activities text,
  key_achievements text,
  project_contributions text,
  meetings_engagements text,
  challenges_lessons text,
  outstanding_responsibilities text,
  recommendations text,
  next_month_priorities text,
  supporting_documents jsonb default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','revision_requested')),
  submitted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, staff_id, reporting_month)
);

-- 4. Report reviews
create table if not exists public.report_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  weekly_report_id uuid references public.weekly_reports(id) on delete cascade,
  monthly_report_id uuid references public.monthly_reports(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('approved','revision_requested','rejected')),
  comments text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 5. Report schedules (admin-configured reminder cadence, recipients)
create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  report_type text not null check (report_type in ('weekly','monthly')),
  deadline_rule text not null,
  reminder_cadence text not null default 'daily',
  grace_period_days integer not null default 0,
  recipients jsonb default '[]'::jsonb, -- staff ids
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, report_type)
);

-- Indexes
create index if not exists idx_reporting_periods_org on public.reporting_periods(organisation_id);
create index if not exists idx_weekly_reports_org_staff on public.weekly_reports(organisation_id, staff_id);
create index if not exists idx_weekly_reports_period on public.weekly_reports(reporting_period_id);
create index if not exists idx_weekly_reports_status on public.weekly_reports(status);
create index if not exists idx_monthly_reports_org_staff on public.monthly_reports(organisation_id, staff_id);
create index if not exists idx_monthly_reports_period on public.monthly_reports(reporting_period_id);
create index if not exists idx_report_reviews_org on public.report_reviews(organisation_id);
create index if not exists idx_report_schedules_org on public.report_schedules(organisation_id);

-- Enable RLS
alter table public.reporting_periods enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.report_reviews enable row level security;
alter table public.report_schedules enable row level security;

-- RLS
create policy reporting_periods_select_own on public.reporting_periods
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy reporting_periods_manage_admin on public.reporting_periods
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy weekly_reports_select_own on public.weekly_reports
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy weekly_reports_manage_own on public.weekly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  );
create policy weekly_reviews_manage_admin on public.weekly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy monthly_reports_select_own on public.monthly_reports
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy monthly_reports_manage_own on public.monthly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  );
create policy monthly_reviews_manage_admin on public.monthly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy report_reviews_select_own on public.report_reviews
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy report_reviews_manage_admin on public.report_reviews
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy report_schedules_select_own on public.report_schedules
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy report_schedules_manage_admin on public.report_schedules
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
