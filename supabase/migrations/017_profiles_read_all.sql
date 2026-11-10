-- Migration 017: Allow admins/directors to read staff profiles within their organisation
-- Ensures the admin Attendance Control table can join profiles (full_name, role)
-- when displaying today's staff attendance records.

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select
  using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin', 'director')
    )
  );
