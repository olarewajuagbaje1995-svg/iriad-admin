-- Migration 005: Communication (chat rooms + announcements)
-- Tables: chat_rooms, chat_room_members, chat_messages, chat_message_attachments,
--         chat_message_reactions, chat_message_reads, announcements, announcement_comments, announcement_reads

-- 1. Chat rooms
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_private boolean not null default false,
  is_archived boolean not null default false,
  who_can_send text not null default 'all' check (who_can_send in ('all','admins_only')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Chat room members
create table if not exists public.chat_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_room_admin boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, profile_id)
);

-- 3. Chat messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  parent_message_id uuid references public.chat_messages(id) on delete set null,
  body text not null,
  message_type text not null default 'text' check (message_type in ('text','image','file','voice_note')),
  edited boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Message attachments
create table if not exists public.chat_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  created_at timestamptz not null default now()
);

-- 5. Message reactions
create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id, emoji)
);

-- 6. Message reads
create table if not exists public.chat_message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, profile_id)
);

-- 7. Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  body text not null,
  category text,
  attachment_url text,
  expires_at timestamptz,
  is_pinned boolean not null default false,
  comments_closed boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Announcement comments
create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Announcement reads (acknowledgements)
create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, profile_id)
);

-- Indexes
create index if not exists idx_chat_rooms_org on public.chat_rooms(organisation_id);
create index if not exists idx_chat_rooms_archived on public.chat_rooms(is_archived);
create index if not exists idx_room_members_room on public.chat_room_members(room_id);
create index if not exists idx_room_members_profile on public.chat_room_members(profile_id);
create index if not exists idx_chat_messages_room on public.chat_messages(room_id, created_at desc);
create index if not exists idx_chat_messages_parent on public.chat_messages(parent_message_id);
create index if not exists idx_message_attachments_message on public.chat_message_attachments(message_id);
create index if not exists idx_message_reactions_message on public.chat_message_reactions(message_id);
create index if not exists idx_message_reads_message on public.chat_message_reads(message_id);
create index if not exists idx_message_reads_profile on public.chat_message_reads(profile_id);
create index if not exists idx_announcements_org on public.announcements(organisation_id);
create index if not exists idx_announcements_published on public.announcements(is_published);
create index if not exists idx_announcement_comments_ann on public.announcement_comments(announcement_id);
create index if not exists idx_announcement_reads_ann on public.announcement_reads(announcement_id);

-- Enable RLS
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_message_attachments enable row level security;
alter table public.chat_message_reactions enable row level security;
alter table public.chat_message_reads enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_comments enable row level security;
alter table public.announcement_reads enable row level security;

-- RLS: chat rooms — members read; admins manage
create policy chat_rooms_select_member on public.chat_rooms
  for select using (
    id in (select room_id from public.chat_room_members where profile_id = auth.uid())
    or organisation_id in (select organisation_id from public.profiles where id = auth.uid()
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','staff_admin')))
  );
create policy chat_rooms_manage_admin on public.chat_rooms
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: room members
create policy chat_room_members_select_own on public.chat_room_members
  for select using (
    profile_id = auth.uid()
    or room_id in (select id from public.chat_rooms where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy chat_room_members_manage_admin on public.chat_room_members
  for all using (
    room_id in (select id from public.chat_rooms where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: messages — room members read/send
create policy chat_messages_select_member on public.chat_messages
  for select using (
    room_id in (select room_id from public.chat_room_members where profile_id = auth.uid())
  );
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
          select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','staff_admin')
        )
      )
    )
  );
create policy chat_messages_update_own on public.chat_messages
  for update using (
    profile_id = auth.uid()
  );

create policy message_attachments_select_member on public.chat_message_attachments
  for select using (
    message_id in (select id from public.chat_messages where room_id in (
      select room_id from public.chat_room_members where profile_id = auth.uid()
    ))
  );
create policy message_attachments_insert_member on public.chat_message_attachments
  for insert with check (
    message_id in (select id from public.chat_messages where profile_id = auth.uid())
  );

create policy message_reactions_select_member on public.chat_message_reactions
  for select using (
    message_id in (select id from public.chat_messages where room_id in (
      select room_id from public.chat_room_members where profile_id = auth.uid()
    ))
  );
create policy message_reactions_manage_own on public.chat_message_reactions
  for all using (
    profile_id = auth.uid()
  )
  with check (profile_id = auth.uid());

create policy message_reads_manage_own on public.chat_message_reads
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- RLS: announcements — org staff read published; admins manage
create policy announcements_select_own on public.announcements
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and (is_published = true
      or exists (
        select 1 from public.profiles p where p.id = auth.uid()
        and p.role in ('super_admin','staff_admin')
      ))
  );
create policy announcements_manage_admin on public.announcements
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

create policy announcement_comments_select_own on public.announcement_comments
  for select using (
    announcement_id in (select id from public.announcements where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  );
create policy announcement_comments_manage_own on public.announcement_comments
  for all using (
    profile_id = auth.uid()
    and announcement_id in (select id from public.announcements where organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    ))
  )
  with check (profile_id = auth.uid());

create policy announcement_reads_manage_own on public.announcement_reads
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
