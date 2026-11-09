-- setup_schema.sql
-- Supabase schema setup for the IRIAD Operations Portal features:
--   * Projects (with project lead)
--   * Chat rooms
--   * Task assignments (assigned_to via task_assignees) and due dates
--
-- This file consolidates the SQL needed for the Tasks, Projects and Chat Room
-- Management features, including permissive Row Level Security (RLS) policies
-- so that inserts and selects do not crash for authenticated organisation members.
--
-- Run this against a fresh Supabase project (or after the base organisation /
-- profiles migrations have been applied).

-- ---------------------------------------------------------------------------
-- 1. Organisations & profiles are assumed to exist from the base schema.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. Projects table (project lead = project_lead_id)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Chat rooms table
-- ---------------------------------------------------------------------------
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_private boolean not null default false,
  is_archived boolean not null default false,
  who_can_send text not null default 'all' check (who_can_send in ('all','admins_only')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Tasks table (due_date) — plus task_assignees for assigned_to
--
-- The tasks table already carries due_date. Task assignment to specific staff
-- is modelled through the task_assignees join table (one task can be assigned
-- to one or more staff members), which is the "assigned_to" mechanism.
-- ---------------------------------------------------------------------------
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

create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  unique (task_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- 5. Supporting project tables referenced by the UI
-- ---------------------------------------------------------------------------
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead','member','viewer')),
  joined_at timestamptz not null default now(),
  unique (project_id, profile_id)
);

create table if not exists public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_room_admin boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- 6. Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_projects_org on public.projects(organisation_id);
create index if not exists idx_projects_lead on public.projects(project_lead_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_profile on public.project_members(profile_id);
create index if not exists idx_tasks_org on public.tasks(organisation_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due on public.tasks(due_date);
create index if not exists idx_task_assignees_task on public.task_assignees(task_id);
create index if not exists idx_task_assignees_profile on public.task_assignees(profile_id);
create index if not exists idx_chat_rooms_org on public.chat_rooms(organisation_id);
create index if not exists idx_chat_rooms_archived on public.chat_rooms(is_archived);
create index if not exists idx_room_members_room on public.chat_room_members(room_id);
create index if not exists idx_room_members_profile on public.chat_room_members(profile_id);

-- ---------------------------------------------------------------------------
-- 7. Enable Row Level Security
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;

-- ---------------------------------------------------------------------------
-- 8. Permissive RLS policies
--
--   * Any authenticated member of an organisation can read that organisation's
--     projects, tasks and chat rooms.
--   * Admins and directors can manage (insert/update/delete) projects and
--     chat rooms within their organisation.
--   * Task assignees can update their own tasks; creators manage tasks.
--   * Chat room membership is readable by org members and manageable by
--     admins/directors.
-- ---------------------------------------------------------------------------

-- Projects
create policy projects_select_org on public.projects
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy projects_manage_admin_dir on public.projects
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- Project members
create policy project_members_select_org on public.project_members
  for select using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy project_members_manage_admin_dir on public.project_members
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- Tasks: org members read; assignees update own status; admins/directors manage
create policy tasks_select_org on public.tasks
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy tasks_manage_admin_dir on public.tasks
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );
create policy tasks_assignee_update_own on public.tasks
  for update using (
    id in (select task_id from public.task_assignees where profile_id = auth.uid())
  );

-- Task assignees
create policy task_assignees_select_org on public.task_assignees
  for select using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy task_assignees_manage_admin_dir on public.task_assignees
  for all using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- Chat rooms: members read; admins/directors manage; org members can see rooms
create policy chat_rooms_select_org on public.chat_rooms
  for select using (
    id in (select room_id from public.chat_room_members where profile_id = auth.uid())
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy chat_rooms_manage_admin_dir on public.chat_rooms
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- Chat room members
create policy chat_room_members_select_org on public.chat_room_members
  for select using (
    profile_id = auth.uid()
    or room_id in (select id from public.chat_rooms where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy chat_room_members_manage_admin_dir on public.chat_room_members
  for all using (
    room_id in (select id from public.chat_rooms where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );
