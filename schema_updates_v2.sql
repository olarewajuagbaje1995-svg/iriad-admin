-- schema_updates_v2.sql
-- Schema updates for Edit/Delete functionality and task assignment fixes.
-- Run this against the Supabase project after the base schema (and setup_schema.sql)
-- has been applied.

-- ---------------------------------------------------------------------------
-- 1. Task assignment column
-- ---------------------------------------------------------------------------
-- The frontend uses the task_assignees join table for task assignment (the
-- existing, normalised approach already in place). No extra column is added
-- to `tasks` here since we are opting to use the join table rather than a
-- denormalised `assigned_to` column.
--
-- If you prefer a direct `assigned_to` column instead, uncomment below:
--
-- alter table public.tasks add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. RLS policies: UPDATE and DELETE on tasks, projects, chat_rooms
-- ---------------------------------------------------------------------------

-- Tasks: admins/directors can update/delete any task; task creators can
-- update/delete their own tasks.
drop policy if exists tasks_update_admin_dir on public.tasks;
create policy tasks_update_admin_dir on public.tasks
  for update using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (
      exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin', 'director')
      )
      or created_by = auth.uid()
    )
  );

drop policy if exists tasks_delete_admin_dir on public.tasks;
create policy tasks_delete_admin_dir on public.tasks
  for delete using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (
      exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin', 'director')
      )
      or created_by = auth.uid()
    )
  );

-- Projects: only admins/directors can update/delete.
drop policy if exists projects_update_admin_dir on public.projects;
create policy projects_update_admin_dir on public.projects
  for update using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

drop policy if exists projects_delete_admin_dir on public.projects;
create policy projects_delete_admin_dir on public.projects
  for delete using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- Chat rooms: only admins/directors can update/delete.
drop policy if exists chat_rooms_update_admin_dir on public.chat_rooms;
create policy chat_rooms_update_admin_dir on public.chat_rooms
  for update using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

drop policy if exists chat_rooms_delete_admin_dir on public.chat_rooms;
create policy chat_rooms_delete_admin_dir on public.chat_rooms
  for delete using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. RLS policy: INSERT on task_assignees for task creators
-- ---------------------------------------------------------------------------

-- Admins/directors can manage all task_assignees (existing policy
-- task_assignees_manage_admin_dir). Additionally allow the creator of a task
-- to insert an assignee for their own task, so regular staff members can
-- assign tasks they create without hitting a silent RLS failure.
drop policy if exists task_assignees_insert_creator on public.task_assignees;
create policy task_assignees_insert_creator on public.task_assignees
  for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
      and t.created_by = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Flush the Supabase schema cache so the new policies take effect immediately.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
