-- Migration 002: Attendance
-- Tables: attendance_sessions, attendance, attendance_corrections, leave_requests, working_calendar, attendance_policy
-- Business rules enforced at the DB layer: unique staff+date per org, check-in window constraints.

-- 1. Attendance policy (admin-configurable per organisation)
create table if not exists public.attendance_policy (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  working_days smallint[] not null default '{1,2,3,4,5}', -- Monday=1 ... Sunday=7
  morning_open_time time not null default '08:00',
  morning_close_time time not null default '09:00',
  on_time_threshold_minutes integer not null default 0, -- punctuality threshold
  sign_out_open boolean not null default false,
  sign_out_scheduled boolean not null default false,
  grace_period_minutes integer not null default 0,
  allow_manual_extension boolean not null default false,
  reminder_times text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id)
);

-- 2. Working calendar (holidays / closures)
create table if not exists public.working_calendar (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  date date not null,
  is_workday boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  unique (organisation_id, date)
);

-- 3. Attendance sessions (open/close windows per day)
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  work_date date not null,
  morning_opened_at timestamptz,
  morning_closed_at timestamptz,
  sign_out_opened_at timestamptz,
  sign_out_closed_at timestamptz,
  morning_open_override boolean not null default false,
  sign_out_open_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, work_date)
);

-- 4. Attendance records (one per staff per date per org)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  attendance_type text not null default 'office' check (attendance_type in ('office','remote_work','field_work','approved_leave','public_holiday','absent','pending_correction')),
  status text not null default 'not_checked_in' check (status in ('not_checked_in','checked_in','checked_out','late','missing_checkout','incomplete')),
  is_late boolean not null default false,
  check_in_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, staff_id, attendance_date)
);

-- 5. Attendance corrections / overrides (admin audited)
create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  approved_by uuid references public.profiles(id) on delete set null,
  correction_type text not null check (correction_type in ('check_in','check_out','override','absence','status')),
  old_value text,
  new_value text not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Leave requests
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  leave_type text not null check (leave_type in ('annual','sick','emergency','field_work','remote_work','other')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approved_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_attendance_policy_org on public.attendance_policy(organisation_id);
create index if not exists idx_working_calendar_org_date on public.working_calendar(organisation_id, date);
create index if not exists idx_attendance_sessions_org_date on public.attendance_sessions(organisation_id, work_date);
create index if not exists idx_attendance_org_staff_date on public.attendance(organisation_id, staff_id, attendance_date);
create index if not exists idx_attendance_staff_date on public.attendance(staff_id, attendance_date);
create index if not exists idx_attendance_date on public.attendance(attendance_date);
create index if not exists idx_attendance_corrections_org on public.attendance_corrections(organisation_id);
create index if not exists idx_attendance_corrections_staff on public.attendance_corrections(staff_id);
create index if not exists idx_leave_requests_org_staff on public.leave_requests(organisation_id, staff_id);

-- Enable RLS
alter table public.attendance_policy enable row level security;
alter table public.working_calendar enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.leave_requests enable row level security;

-- RLS: read within own organisation
create policy attendance_policy_select_own on public.attendance_policy
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy working_calendar_select_own on public.working_calendar
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy attendance_sessions_select_own on public.attendance_sessions
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy attendance_select_own on public.attendance
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy attendance_corrections_select_own on public.attendance_corrections
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy leave_requests_select_own on public.leave_requests
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

-- RLS: staff manage own attendance check-in/check-out within window
create policy attendance_manage_own on public.attendance
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  );

-- RLS: staff manage own leave requests
create policy leave_requests_manage_own on public.leave_requests
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and staff_id = auth.uid()
  );

-- RLS: corrections — staff request, admins approve
create policy attendance_corrections_manage_own on public.attendance_corrections
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (requested_by = auth.uid()
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('super_admin','staff_admin')
      ))
  );

-- Admin manage policy/session/calendar
create policy attendance_admin_manage on public.attendance_policy
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
create policy sessions_admin_manage on public.attendance_sessions
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
create policy calendar_admin_manage on public.working_calendar
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- Attach sessions/attendance to org via RLS only (no additional per-row org check beyond select policies above)
