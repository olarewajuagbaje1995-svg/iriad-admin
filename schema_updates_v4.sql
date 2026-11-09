-- schema_updates_v4.sql
-- Fix infinite recursion in tasks/task_assignees RLS policies and
-- replace restrictive chat_messages policies with flat org-wide policies.
-- Also creates the 'chat_images' Supabase Storage bucket for image uploads.
--
-- Run this after schema_updates_v3.sql has been applied.
-- Then run: notify pgrst, 'reload schema'; (included at the bottom).

-- ---------------------------------------------------------------------------
-- 1. Tasks: flat policies (no cross-table lookups into task_assignees)
-- ---------------------------------------------------------------------------

drop policy if exists tasks_select_org on public.tasks;
drop policy if exists tasks_manage_admin_dir on public.tasks;
drop policy if exists tasks_assignee_update_own on public.tasks;
drop policy if exists tasks_update_admin_dir on public.tasks;
drop policy if exists tasks_delete_admin_dir on public.tasks;

-- Staff see tasks they created; admins/directors see all org tasks.
create policy tasks_select_flat on public.tasks
  for select using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
        and p.organisation_id = tasks.organisation_id
    )
  );

-- Any authenticated org member can create a task.
create policy tasks_insert_flat on public.tasks
  for insert with check (
    created_by = auth.uid()
    and organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
  );

-- Task creators or admins/directors can update.
create policy tasks_update_flat on public.tasks
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
        and p.organisation_id = tasks.organisation_id
    )
  );

-- Task creators or admins/directors can delete.
create policy tasks_delete_flat on public.tasks
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
        and p.organisation_id = tasks.organisation_id
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Task assignees: flat policies (no cross-table lookups into tasks)
-- ---------------------------------------------------------------------------

drop policy if exists task_assignees_select_org on public.task_assignees;
drop policy if exists task_assignees_manage_admin_dir on public.task_assignees;
drop policy if exists task_assignees_insert_creator on public.task_assignees;

-- You can see assignee rows where you are the assignee or the assigner,
-- or if you are an admin/director.
create policy task_assignees_select_flat on public.task_assignees
  for select using (
    profile_id = auth.uid()
    or assigned_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- You can insert an assignee row if you are the assigner, or an admin/director.
create policy task_assignees_insert_flat on public.task_assignees
  for insert with check (
    assigned_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- Assigner or admin/director can update.
create policy task_assignees_update_flat on public.task_assignees
  for update using (
    assigned_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- Assigner or admin/director can delete.
create policy task_assignees_delete_flat on public.task_assignees
  for delete using (
    assigned_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'director')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Chat messages: flat org-wide policies (fixes admin/staff invisibility)
-- ---------------------------------------------------------------------------

drop policy if exists chat_messages_select_member on public.chat_messages;
drop policy if exists chat_messages_insert_member on public.chat_messages;
drop policy if exists chat_messages_update_own on public.chat_messages;

-- Any authenticated org member can read messages in their org's rooms.
create policy chat_messages_select_flat on public.chat_messages
  for select using (
    room_id in (
      select r.id from public.chat_rooms r
      where r.organisation_id in (
        select p.organisation_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

-- Any authenticated org member can insert messages into their org's rooms.
create policy chat_messages_insert_flat on public.chat_messages
  for insert with check (
    profile_id = auth.uid()
    and room_id in (
      select r.id from public.chat_rooms r
      where r.organisation_id in (
        select p.organisation_id from public.profiles p where p.id = auth.uid()
      )
    )
  );

-- Message sender can update their own messages.
create policy chat_messages_update_flat on public.chat_messages
  for update using (
    profile_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 4. Supabase Storage: public 'chat_images' bucket for image uploads
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('chat_images', 'chat_images', true)
on conflict (id) do nothing;

create policy chat_images_select_auth on storage.objects
  for select using (bucket_id = 'chat_images' and auth.uid() is not null);

create policy chat_images_insert_auth on storage.objects
  for insert with check (bucket_id = 'chat_images' and auth.uid() is not null);

create policy chat_images_update_auth on storage.objects
  for update using (bucket_id = 'chat_images' and auth.uid() is not null);

create policy chat_images_delete_auth on storage.objects
  for delete using (bucket_id = 'chat_images' and auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 5. Flush the Supabase schema cache so the new policies take effect.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
