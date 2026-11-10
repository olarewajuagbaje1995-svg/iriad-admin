-- Migration 016: Allow staff to INSERT their own attendance records
-- Reverts the Edge Function-only insert restriction from migration 015
-- so the frontend can write attendance rows directly via client-side Supabase calls.

drop policy if exists attendance_insert_own on public.attendance;
create policy attendance_insert_own on public.attendance
  for insert
  with check (staff_id = auth.uid());
