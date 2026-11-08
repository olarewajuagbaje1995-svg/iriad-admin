-- Migration 003: Tasks and projects
-- Tables: tasks, task_assignees, task_updates, projects, project_members, project_milestones,
--         project_tables, project_table_columns, project_table_rows, project_deliverables, project_reviews

-- 1. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  objectives text,
  start_date date,
  end_date date,
  project_lead_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planning' check (status in ('planning','active','on_hold','completed','cancelled','archived')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Project members
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member','viewer')),
  joined_at timestamptz not null default now(),
  unique (project_id, profile_id)
);

-- 3. Project milestones
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed','delayed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  instructions text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'not_started' check (status in ('not_started','in_progress','submitted','revision_requested','completed','overdue','cancelled')),
  due_date date,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Task assignees (one or more staff)
create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  unique (task_id, profile_id)
);

-- 6. Task updates (status history + progress notes + deliverables)
create table if not exists public.task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('not_started','in_progress','submitted','revision_requested','completed','overdue','cancelled')),
  progress_note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. Custom project tables (table builder)
create table if not exists public.project_tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Custom project table columns
create table if not exists public.project_table_columns (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.project_tables(id) on delete cascade,
  name text not null,
  column_type text not null check (column_type in ('short_text','long_text','number','date','dropdown','status','staff_member','checkbox','attachment')),
  options jsonb default '[]'::jsonb, -- for dropdown/status options
  is_required boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- 9. Custom project table rows
create table if not exists public.project_table_rows (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.project_tables(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. Project deliverables
create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'created' check (status in ('created','assigned','in_progress','submitted','under_review','approved','revision_requested','completed')),
  version integer not null default 1,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Project reviews (deliverable review history)
create table if not exists public.project_reviews (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.project_deliverables(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('approved','revision_requested','rejected')),
  comments text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_projects_org on public.projects(organisation_id);
create index if not exists idx_projects_lead on public.projects(project_lead_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_profile on public.project_members(profile_id);
create index if not exists idx_milestones_project on public.project_milestones(project_id);
create index if not exists idx_tasks_org on public.tasks(organisation_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due on public.tasks(due_date);
create index if not exists idx_task_assignees_task on public.task_assignees(task_id);
create index if not exists idx_task_assignees_profile on public.task_assignees(profile_id);
create index if not exists idx_task_updates_task on public.task_updates(task_id);
create index if not exists idx_project_tables_project on public.project_tables(project_id);
create index if not exists idx_table_columns_table on public.project_table_columns(table_id);
create index if not exists idx_table_rows_table on public.project_table_rows(table_id);
create index if not exists idx_deliverables_project on public.project_deliverables(project_id);
create index if not exists idx_project_reviews_deliverable on public.project_reviews(deliverable_id);

-- Enable RLS
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_updates enable row level security;
alter table public.project_tables enable row level security;
alter table public.project_table_columns enable row level security;
alter table public.project_table_rows enable row level security;
alter table public.project_deliverables enable row level security;
alter table public.project_reviews enable row level security;

-- RLS helpers: project members / org members
create policy projects_select_own on public.projects
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy projects_manage_admin on public.projects
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy project_members_select_own on public.project_members
  for select using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy project_members_manage_admin on public.project_members
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy milestones_select_own on public.project_milestones
  for select using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy milestones_manage_admin on public.project_milestones
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- Tasks: org members read; assignees update own status; admins manage
create policy tasks_select_own on public.tasks
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy tasks_manage_admin on public.tasks
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
create policy tasks_assignee_update_own on public.tasks
  for update using (
    id in (select task_id from public.task_assignees where profile_id = auth.uid())
  );

create policy task_assignees_select_own on public.task_assignees
  for select using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy task_assignees_manage_admin on public.task_assignees
  for all using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy task_updates_select_own on public.task_updates
  for select using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy task_updates_manage_own on public.task_updates
  for all using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and profile_id = auth.uid()
  )
  with check (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and profile_id = auth.uid()
  );

-- Custom project tables
create policy project_tables_select_own on public.project_tables
  for select using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy project_tables_manage_admin on public.project_tables
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy table_columns_select_own on public.project_table_columns
  for select using (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
  );
create policy table_columns_manage_admin on public.project_table_columns
  for all using (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy table_rows_select_own on public.project_table_rows
  for select using (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
  );
create policy table_rows_manage_own on public.project_table_rows
  for all using (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and created_by = auth.uid()
  )
  with check (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and created_by = auth.uid()
  );

-- Deliverables and reviews
create policy deliverables_select_own on public.project_deliverables
  for select using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy deliverables_manage_admin on public.project_deliverables
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
create policy deliverables_submitter_update on public.project_deliverables
  for update using (
    submitted_by = auth.uid()
  );

create policy project_reviews_select_own on public.project_reviews
  for select using (
    deliverable_id in (select id from public.project_deliverables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
  );
create policy project_reviews_manage_admin on public.project_reviews
  for all using (
    deliverable_id in (select id from public.project_deliverables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );
