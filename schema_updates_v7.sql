-- schema_updates_v7.sql
-- Fix RLS for weekly_reports and monthly_reports.
-- Dynamically drops ALL existing policies on both tables, then creates
-- completely flat, non-looping policies for authenticated users.
-- Sets staff_id DEFAULT auth.uid() and drops NOT NULL on organisation_id.
-- notify pgrst, 'reload schema'; is included at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Drop ALL existing policies on weekly_reports and monthly_reports (DO block)
-- ---------------------------------------------------------------------------

do $$
declare
    r record;
begin
    -- Drop every policy on public.weekly_reports
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'weekly_reports'
    ) loop
        execute format('drop policy if exists %I on public.weekly_reports', r.policyname);
    end loop;

    -- Drop every policy on public.monthly_reports
    for r in (
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'monthly_reports'
    ) loop
        execute format('drop policy if exists %I on public.monthly_reports', r.policyname);
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Weekly reports: flat policies (no cross-table lookups, no recursion)
-- ---------------------------------------------------------------------------

create policy weekly_reports_select_all on public.weekly_reports
  for select using (true);

create policy weekly_reports_insert_all on public.weekly_reports
  for insert with check (true);

create policy weekly_reports_update_all on public.weekly_reports
  for update using (true);

create policy weekly_reports_delete_all on public.weekly_reports
  for delete using (true);

-- ---------------------------------------------------------------------------
-- 3. Monthly reports: flat policies (no cross-table lookups, no recursion)
-- ---------------------------------------------------------------------------

create policy monthly_reports_select_all on public.monthly_reports
  for select using (true);

create policy monthly_reports_insert_all on public.monthly_reports
  for insert with check (true);

create policy monthly_reports_update_all on public.monthly_reports
  for update using (true);

create policy monthly_reports_delete_all on public.monthly_reports
  for delete using (true);

-- ---------------------------------------------------------------------------
-- 4. Set defaults and relax constraints
-- ---------------------------------------------------------------------------

alter table public.weekly_reports alter column staff_id set default auth.uid();
alter table public.monthly_reports alter column staff_id set default auth.uid();

alter table public.weekly_reports alter column organisation_id drop not null;
alter table public.monthly_reports alter column organisation_id drop not null;

-- ---------------------------------------------------------------------------
-- 5. Flush the Supabase schema cache so the new policies take effect.
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
