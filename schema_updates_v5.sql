-- schema_updates_v5.sql
-- Fix infinite recursion in projects/project_members RLS policies.
-- Dynamically drops ALL existing policies on both tables, then creates
-- flat, non-looping policies that cannot reference each other.
--
-- Run this after schema_updates_v4.sql has been applied.
-- notify pgrst, 'reload schema'; is included at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Drop ALL existing policies on projects and project_members (DO block)
-- ---------------------------------------------------------------------------

do $$
declare
    r record;
begin
    -- Drop every policy on public.projects
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'projects'
    ) loop
        execute format('drop policy if exists %I on public.projects', r.policyname);
    end loop;

    -- Drop every policy on public.project_members
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'project_members'
    ) loop
        execute format('drop policy if exists %I on public.project_members', r.policyname);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Projects: flat policies (no cross-table references to project_members)
-- ---------------------------------------------------------------------------

-- All authenticated org members can see their org's projects.
create policy projects_select_flat on public.projects
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

-- Authenticated org members can create projects in their org.
create policy projects_insert_flat on public.projects
  for insert with check (
    created_by = auth.uid()
    and organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

-- Task creators or admins/directors can update.
create policy projects_update_flat on public.projects
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
        and p.organisation_id = projects.organisation_id
    )
  );

-- Task creators or admins/directors can delete.
create policy projects_delete_flat on public.projects
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
        and p.organisation_id = projects.organisation_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Project members: flat policies (no cross-table references to projects)
-- ---------------------------------------------------------------------------

-- You can see your own memberships; admins/directors can see all.
create policy project_members_select_flat on public.project_members
  for select using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- Only admins/directors can insert memberships.
create policy project_members_insert_flat on public.project_members
  for insert with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- Only admins/directors can update memberships.
create policy project_members_update_flat on public.project_members
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- Only admins/directors can delete memberships.
create policy project_members_delete_flat on public.project_members
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Flush the Supabase schema cache so the new policies take effect.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
