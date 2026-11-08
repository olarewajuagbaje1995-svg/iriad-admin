-- Migration 010: match_knowledge_chunks RPC for pgvector semantic search
-- Enables role-filtered vector similarity search over knowledge_chunks.

-- Ensure pgvector extension is available
create extension if not exists vector;

-- 1. match_knowledge_chunks RPC function
-- Performs cosine similarity search over knowledge_chunks with:
--   - organisation_id scoping (multi-tenant)
--   - allowed_roles overlap filtering (RBAC)
--   - visibility filtering (all_staff / selected_roles / admin_only)
--   - similarity threshold and max result count
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  p_organisation_id uuid default null,
  p_allowed_roles text[] default null
)
returns table (
  id uuid,
  source_id uuid,
  organisation_id uuid,
  content text,
  similarity float,
  metadata jsonb,
  visibility text,
  allowed_roles text[],
  source_title text
)
language plpgsql
as $$
begin
  return query
  select
    kc.id,
    kc.source_id,
    kc.organisation_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kc.metadata,
    kc.visibility,
    kc.allowed_roles,
    ks.title as source_title
  from knowledge_chunks kc
  join knowledge_sources ks on ks.id = kc.source_id
  where kc.embedding is not null
    and ks.indexing_status = 'indexed'
    and (p_organisation_id is null or kc.organisation_id = p_organisation_id)
    and (p_allowed_roles is null or kc.allowed_roles && p_allowed_roles)
    and (
      kc.visibility = 'all_staff'
      or (p_allowed_roles is not null and kc.allowed_roles && p_allowed_roles)
    )
    and (1 - (kc.embedding <=> query_embedding)) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 2. Grant execute on the RPC to authenticated and service_role
grant execute on function public.match_knowledge_chunks(vector(1536), float, int, uuid, text[]) to authenticated;
grant execute on function public.match_knowledge_chunks(vector(1536), float, int, uuid, text[]) to service_role;

-- 3. Comment for documentation
comment on function public.match_knowledge_chunks(vector(1536), float, int, uuid, text[]) is
  'Semantic search over knowledge_chunks with org scoping, role-based visibility, and cosine similarity.';
