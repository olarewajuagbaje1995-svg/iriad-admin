-- Migration 015: Attendance RLS hardening + server-side check-in
--
-- Hardens RLS on public.attendance so clients can no longer directly INSERT
-- attendance records. Check-ins and sign-outs now go through the
-- `attendance-control` Edge Function, which runs with the service role key
-- and enforces the Africa/Lagos check-in/sign-out windows server-side.
--
-- Policies:
--   * staff:    SELECT their own records only.
--   * staff:    UPDATE their own current day's record only (sign-out),
--               where "today" is evaluated in Africa/Lagos wall-clock time.
--   * admin/director: SELECT and UPDATE attendance within their organisation.
--   * No client INSERT privilege exists for any role -> attendance rows can
--               only be created by the attendance-control Edge Function
--               (service role, which bypasses RLS).

-- Remove the broad policy that previously let staff INSERT/update their own
-- attendance records directly from the client.
drop policy if exists attendance_manage_own on public.attendance;

-- Staff select their own records only.
drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own on public.attendance
  for select
  using ( staff_id = auth.uid() );

-- Staff update their own current day's record (e.g. sign-out).
create policy attendance_update_own_today on public.attendance
  for update
  using (
    staff_id = auth.uid()
    and attendance_date = (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos'))::date
  )
  with check (
    staff_id = auth.uid()
    and attendance_date = (date_trunc('day', now() AT TIME ZONE 'Africa/Lagos'))::date
  );

-- Admin/director select attendance within their organisation.
drop policy if exists attendance_admin_manage on public.attendance;
create policy attendance_admin_select on public.attendance
  for select
  using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'director')
    )
  );

-- Admin/director update attendance within their organisation (e.g. approved
-- corrections). Intentionally no INSERT privilege: check-ins are created only
-- by the attendance-control Edge Function, never by clients.
create policy attendance_admin_update on public.attendance
  for update
  using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'director')
    )
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'director')
    )
  );
