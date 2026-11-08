-- Migration 008: RAG knowledge base and staff chatbot
-- Tables: knowledge_collections, knowledge_sources, knowledge_chunks,
--         knowledge_ingestion_jobs, chatbot_conversations, chatbot_messages, chatbot_feedback

-- 1. Knowledge collections / categories
create table if not exists public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Knowledge sources (files, text, URLs, FAQs, structured records)
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  collection_id uuid references public.knowledge_collections(id) on delete set null,
  title text not null,
  description text,
  source_type text not null check (source_type in ('file','text','url','faq','structured_record')),
  storage_path text, -- private bucket for files
  url text,
  audience text not null default 'all_staff' check (audience in ('all_staff','selected_roles','admin_only')),
  allowed_roles text[] default '{}', -- roles allowed when audience = selected_roles
  tags text[] default '{}',
  effective_date date,
  is_enabled boolean not null default true,
  indexing_status text not null default 'pending' check (indexing_status in ('pending','indexing','indexed','failed','superseded')),
  last_indexed_at timestamptz,
  error_message text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Knowledge chunks (vector embeddings stored with pgvector)
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  collection_id uuid references public.knowledge_collections(id) on delete set null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536), -- matches typical embedding dimension; adjust to your model
  metadata jsonb default '{}'::jsonb,
  visibility text not null default 'all_staff' check (visibility in ('all_staff','selected_roles','admin_only')),
  allowed_roles text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Ingestion jobs
create table if not exists public.knowledge_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  chunks_created integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Chatbot conversations
create table if not exists public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Chatbot messages
create table if not exists public.chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chatbot_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sources jsonb default '[]'::jsonb, -- cited source titles/links
  created_at timestamptz not null default now()
);

-- 7. Chatbot feedback
create table if not exists public.chatbot_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chatbot_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating text not null check (rating in ('helpful','not_helpful')),
  comment text,
  created_at timestamptz not null default now()
);

-- pgvector extension (create if available)
create extension if not exists vector;

-- Indexes
create index if not exists idx_knowledge_collections_org on public.knowledge_collections(organisation_id);
create index if not exists idx_knowledge_sources_org on public.knowledge_sources(organisation_id);
create index if not exists idx_knowledge_sources_collection on public.knowledge_sources(collection_id);
create index if not exists idx_knowledge_chunks_org on public.knowledge_chunks(organisation_id);
create index if not exists idx_knowledge_chunks_source on public.knowledge_chunks(source_id);
create index if not exists idx_knowledge_chunks_collection on public.knowledge_chunks(collection_id);
create index if not exists idx_ingestion_jobs_source on public.knowledge_ingestion_jobs(source_id);
create index if not exists idx_chatbot_conversations_profile on public.chatbot_conversations(profile_id);
create index if not exists idx_chatbot_messages_conversation on public.chatbot_messages(conversation_id, created_at);
create index if not exists idx_chatbot_feedback_message on public.chatbot_feedback(message_id);

-- Vector index for similarity search (ivfflat; use hnsw if preferred)
create index if not exists idx_knowledge_chunks_embedding on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Enable RLS
alter table public.knowledge_collections enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_ingestion_jobs enable row level security;
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.chatbot_feedback enable row level security;

-- RLS: collections — read within org; admins manage
create policy knowledge_collections_select_own on public.knowledge_collections
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy knowledge_collections_manage_admin on public.knowledge_collections
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: sources — read within org (audience filtering applied in API); admins manage
create policy knowledge_sources_select_own on public.knowledge_sources
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy knowledge_sources_manage_admin on public.knowledge_sources
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: chunks — organisation-scoped; audience/role filtering enforced in retrieval layer
create policy knowledge_chunks_select_own on public.knowledge_chunks
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );

create policy knowledge_ingestion_jobs_select_own on public.knowledge_ingestion_jobs
  for select using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
  );
create policy knowledge_ingestion_jobs_manage_admin on public.knowledge_ingestion_jobs
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('super_admin','staff_admin')
    )
  );

-- RLS: chatbot — own conversations/messages
create policy chatbot_conversations_manage_own on public.chatbot_conversations
  for all using (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and profile_id = auth.uid()
  )
  with check (
    organisation_id in (select organisation_id from public.profiles where id = auth.uid())
    and profile_id = auth.uid()
  );
create policy chatbot_messages_manage_own on public.chatbot_messages
  for all using (
    conversation_id in (select id from public.chatbot_conversations where profile_id = auth.uid())
  )
  with check (
    conversation_id in (select id from public.chatbot_conversations where profile_id = auth.uid())
    and profile_id = auth.uid()
  );
create policy chatbot_feedback_manage_own on public.chatbot_feedback
  for all using (
    profile_id = auth.uid()
  )
  with check (profile_id = auth.uid());
