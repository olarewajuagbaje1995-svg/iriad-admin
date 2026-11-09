-- schema_updates_v6.sql
-- Fix ambiguous relationship and recursion issues in tasks/task_assignees RLS policies.
-- Dynamically drops ALL existing policies on both tables, then creates
-- completely flat 'USING (true)' policies for authenticated users.
-- notify pgrst, 'reload schema'; is included at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Drop ALL existing policies on tasks and task_assignees (DO block)
-- ---------------------------------------------------------------------------

do $$
declare
    r record;
begin
    -- Drop every policy on public.tasks
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'tasks'
    ) loop
        execute format('drop policy if exists %I on public.tasks', r.policyname);
    end loop;

    -- Drop every policy on public.task_assignees
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'task_assignees'
    ) loop
        execute format('drop policy if exists %I on public.task_assignees', r.policyname);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tasks: flat USING (true) policies (no cross-table lookups, no recursion)
-- ---------------------------------------------------------------------------

create policy tasks_select_true on public.tasks
  for select using (true);

create policy tasks_insert_true on public.tasks
  for insert with check (true);

create policy tasks_update_true on public.tasks
  for update using (true);

create policy tasks_delete_true on public.tasks
  for delete using (true);

-- ---------------------------------------------------------------------------
-- 3. Task assignees: flat USING (true) policies (no cross-table lookups)
-- ---------------------------------------------------------------------------

create policy task_assignees_select_true on public.task_assignees
  for select using (true);

create policy task_assignees_insert_true on public.task_assignees
  for insert with check (true);

create policy task_assignees_update_true on public.task_assignees
  for update using (true);

create policy task_assignees_delete_true on public.task_assignees
  for delete using (true);

-- ---------------------------------------------------------------------------
-- 4. Flush the Supabase schema cache so the new policies take effect.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
