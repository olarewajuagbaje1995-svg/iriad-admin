-- Migration 011: Role alignment (database)
-- Part of Phase 3 of the Dual Automation Engine brief.
--
-- PURPOSE
--   Align the database role system with the agreed three-role structure used by
--   the frontend (admin / director / staff):
--     * super_admin -> admin
--     * staff_admin -> admin
--     * ceo         -> director
--     * staff       -> staff (unchanged)
--   No accounts are deleted, no history is lost, and no new privileges are
--   granted. Check constraints are tightened to ('admin','director','staff')
--   and every RLS policy that referenced super_admin/staff_admin is rewritten
--   to reference admin/director.
--
-- ORDERING NOTE
--   This migration must run BEFORE migration 012 (automation engine foundation),
--   because the automation tables' RLS policies reference admin/director roles.
--
-- REVIEW ONLY — do not apply to production until approved and staged-tested.

-- ============================================================
-- 1. Data mapping — preserve all accounts and history
-- ============================================================

update public.profiles
set role = 'admin'
where role in ('super_admin','staff_admin');

update public.profiles
set role = 'director'
where role = 'ceo';

update public.organisation_members
set role = 'admin'
where role in ('super_admin','staff_admin');

update public.organisation_members
set role = 'director'
where role = 'ceo';

-- ============================================================
-- 2. Tighten check constraints
--    Robustly drop any existing check constraint on the role column,
--    then add the aligned three-role constraint. Uses dynamic lookup
--    so it works regardless of the auto-generated constraint name.
-- ============================================================

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and conkey @> array[
      select attnum from pg_attribute
      where attrelid = 'public.profiles'::regclass and attname = 'role'
    ];

  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
  end if;

  alter table public.profiles add constraint profiles_role_check
    check (role in ('admin','director','staff'));
end $$;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.organisation_members'::regclass
    and contype = 'c'
    and conkey @> array[
      select attnum from pg_attribute
      where attrelid = 'public.organisation_members'::regclass and attname = 'role'
    ];

  if cname is not null then
    execute format('alter table public.organisation_members drop constraint %I', cname);
  end if;

  alter table public.organisation_members add constraint organisation_members_role_check
    check (role in ('admin','director','staff'));
end $$;

-- ============================================================
-- 3. Rewrite RLS policies: super_admin/staff_admin -> admin/director
--    Each policy is dropped (if present) and recreated with the aligned roles.
--    No policy semantics change — only the permitted role literals.
-- ============================================================

-- Migration 001 (core organisation, identity, system tables)
drop policy if exists profiles_manage_admin on public.profiles;
create policy profiles_manage_admin on public.profiles
  for all using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists settings_manage_admin on public.system_settings;
create policy settings_manage_admin on public.system_settings
  for all using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 002 (attendance)
drop policy if exists attendance_corrections_manage_own on public.attendance_corrections;
create policy attendance_corrections_manage_own on public.attendance_corrections
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (requested_by = auth.uid()
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin','director')
      ))
  );

drop policy if exists attendance_admin_manage on public.attendance_policy;
create policy attendance_admin_manage on public.attendance_policy
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists sessions_admin_manage on public.attendance_sessions;
create policy sessions_admin_manage on public.attendance_sessions
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists calendar_admin_manage on public.working_calendar;
create policy calendar_admin_manage on public.working_calendar
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 003 (tasks and projects)
drop policy if exists projects_manage_admin on public.projects;
create policy projects_manage_admin on public.projects
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists project_members_manage_admin on public.project_members;
create policy project_members_manage_admin on public.project_members
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists milestones_manage_admin on public.project_milestones;
create policy milestones_manage_admin on public.project_milestones
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists tasks_manage_admin on public.tasks;
create policy tasks_manage_admin on public.tasks
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists task_assignees_manage_admin on public.task_assignees;
create policy task_assignees_manage_admin on public.task_assignees
  for all using (
    task_id in (select id from public.tasks where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists project_tables_manage_admin on public.project_tables;
create policy project_tables_manage_admin on public.project_tables
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists table_columns_manage_admin on public.project_table_columns;
create policy table_columns_manage_admin on public.project_table_columns
  for all using (
    table_id in (select id from public.project_tables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists deliverables_manage_admin on public.project_deliverables;
create policy deliverables_manage_admin on public.project_deliverables
  for all using (
    project_id in (select id from public.projects where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists project_reviews_manage_admin on public.project_reviews;
create policy project_reviews_manage_admin on public.project_reviews
  for all using (
    deliverable_id in (select id from public.project_deliverables where project_id in (
      select id from public.projects where organisation_id in (
        select organisation_id from public.profiles where id = auth.uid()
      )
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 004 (weekly and monthly reporting)
drop policy if exists reporting_periods_manage_admin on public.reporting_periods;
create policy reporting_periods_manage_admin on public.reporting_periods
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists weekly_reviews_manage_admin on public.weekly_reports;
create policy weekly_reviews_manage_admin on public.weekly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists monthly_reviews_manage_admin on public.monthly_reports;
create policy monthly_reviews_manage_admin on public.monthly_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists report_reviews_manage_admin on public.report_reviews;
create policy report_reviews_manage_admin on public.report_reviews
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists report_schedules_manage_admin on public.report_schedules;
create policy report_schedules_manage_admin on public.report_schedules
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 005 (communication: chat rooms + announcements)
drop policy if exists chat_rooms_select_member on public.chat_rooms;
create policy chat_rooms_select_member on public.chat_rooms
  for select using (
    id in (select room_id from public.chat_room_members where profile_id = auth.uid())
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','director')))
  );

drop policy if exists chat_rooms_manage_admin on public.chat_rooms;
create policy chat_rooms_manage_admin on public.chat_rooms
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists chat_room_members_manage_admin on public.chat_room_members;
create policy chat_room_members_manage_admin on public.chat_room_members
  for all using (
    room_id in (select id from public.chat_rooms where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists chat_messages_insert_member on public.chat_messages;
create policy chat_messages_insert_member on public.chat_messages
  for insert with check (
    profile_id = auth.uid()
    and room_id in (
      select r.id from public.chat_rooms r
      join public.chat_room_members m on m.room_id = r.id
      where m.profile_id = auth.uid()
      and (r.who_can_send = 'all'
        or exists (
          select 1 from public.chat_room_members m2
          where m2.room_id = r.id and m2.profile_id = auth.uid() and m2.is_room_admin = true
        )
        or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','director')
        )
      )
    )
  );

drop policy if exists announcements_select_own on public.announcements;
create policy announcements_select_own on public.announcements
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (is_published = true
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin','director')
      ))
  );

drop policy if exists announcements_manage_admin on public.announcements;
create policy announcements_manage_admin on public.announcements
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 006 (documents and calendar)
drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (is_public = true or owner_id = auth.uid()
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('admin','director')
      ))
  );

drop policy if exists documents_manage_admin on public.documents;
create policy documents_manage_admin on public.documents
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists calendar_events_manage_admin on public.calendar_events;
create policy calendar_events_manage_admin on public.calendar_events
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 007 (notifications and automated reporting)
drop policy if exists email_report_recipients_manage_admin on public.email_report_recipients;
create policy email_report_recipients_manage_admin on public.email_report_recipients
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists generated_reports_manage_admin on public.generated_reports;
create policy generated_reports_manage_admin on public.generated_reports
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- Migration 008 (RAG knowledge base and staff chatbot)
drop policy if exists knowledge_collections_manage_admin on public.knowledge_collections;
create policy knowledge_collections_manage_admin on public.knowledge_collections
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists knowledge_sources_manage_admin on public.knowledge_sources;
create policy knowledge_sources_manage_admin on public.knowledge_sources
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

drop policy if exists knowledge_ingestion_jobs_manage_admin on public.knowledge_ingestion_jobs;
create policy knowledge_ingestion_jobs_manage_admin on public.knowledge_ingestion_jobs
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );

-- ============================================================
-- Note: migrations 009 and 010 contain no super_admin/staff_admin/ceo
-- references and need no changes.
-- ============================================================
