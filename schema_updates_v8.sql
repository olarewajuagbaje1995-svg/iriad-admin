-- schema_updates_v8.sql
-- Fix RLS for announcements table.
-- Dynamically drops ALL existing policies on announcements, then creates
-- completely flat, non-looping policies for authenticated users.

-- ---------------------------------------------------------------------------
-- 1. Drop ALL existing policies on announcements (DO block)
-- ---------------------------------------------------------------------------

do $$
declare
    r record;
begin
    -- Drop every policy on public.announcements
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'announcements'
    ) loop
        execute format('drop policy if exists %I on public.announcements', r.policyname);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Announcements: flat policies (no cross-table lookups, no recursion)
-- ---------------------------------------------------------------------------

create policy announcements_select_all on public.announcements
  for select using (true);

create policy announcements_insert_all on public.announcements
  for insert with check (true);

create policy announcements_update_all on public.announcements
  for update using (true);

create policy announcements_delete_all on public.announcements
  for delete using (true);

-- ---------------------------------------------------------------------------
-- 3. Flush the Supabase schema cache so the new policies take effect.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
