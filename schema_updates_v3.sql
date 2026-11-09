-- schema_updates_v3.sql
-- Strict role-based visibility policies for Tasks and Projects.
-- Run this after schema_updates_v2.sql has been applied.
--
-- Replaces the permissive org-wide SELECT policies with strict role-based ones:
--   * Admins/Directors see ALL tasks/projects in their organisation.
--   * Staff see only tasks they created or are assigned to, and projects they
--     created, lead, or are a member of.

-- ---------------------------------------------------------------------------
-- 1. Tasks: strict SELECT policy
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select_org on public.tasks;
create policy tasks_select_strict on public.tasks
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (
      exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin', 'director')
      )
      or created_by = auth.uid()
      or id in (select task_id from public.task_assignees where profile_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Projects: strict SELECT policy
-- ---------------------------------------------------------------------------
drop policy if exists projects_select_org on public.projects;
create policy projects_select_strict on public.projects
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (
      exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin', 'director')
      )
      or created_by = auth.uid()
      or project_lead_id = auth.uid()
      or id in (select project_id from public.project_members where profile_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Flush the Supabase schema cache so the new policies take effect immediately.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
