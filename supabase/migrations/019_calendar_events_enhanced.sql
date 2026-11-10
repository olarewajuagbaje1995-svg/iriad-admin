-- Migration 019: Enhance calendar_events table with event_date, event_time, category
-- Adds denormalized date/time/category columns for simpler calendar UI queries.
-- Also updates RLS policies to allow authenticated select/insert/delete within organisation.

alter table public.calendar_events
  add column if not exists event_date date;

alter table public.calendar_events
  add column if not exists event_time time;

alter table public.calendar_events
  add column if not exists category text;

-- Index for date-range queries
create index if not exists idx_calendar_events_date on public.calendar_events(event_date);

-- RLS: calendar events — authenticated select within organisation
drop policy if exists calendar_events_select_own on public.calendar_events;
create policy calendar_events_select_own on public.calendar_events
  for select
  using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

-- RLS: calendar events — authenticated insert within organisation
drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own on public.calendar_events
  for insert
  with check (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and created_by = auth.uid()
  );

-- RLS: calendar events — authenticated delete within organisation (creator or admin)
drop policy if exists calendar_events_delete_own on public.calendar_events;
create policy calendar_events_delete_own on public.calendar_events
  for delete
  using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and (
      created_by = auth.uid()
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin', 'director')
      )
    )
  );
