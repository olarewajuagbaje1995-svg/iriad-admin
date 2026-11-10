-- Migration 018: Denormalize attendance table with staff full_name and role
-- Adds full_name and role columns directly to public.attendance
-- so the admin UI can display staff names without joining profiles.

alter table public.attendance
  add column if not exists full_name text;

alter table public.attendance
  add column if not exists role text default 'staff';
