-- Migration 009: RAG content column and storage setup additions
-- Adds content column to knowledge_sources for direct text/FAQ sources.

-- 1. content column on knowledge_sources (direct text / FAQ body)
alter table public.knowledge_sources
add column if not exists content text;

-- 2. Comment on column for clarity
comment on column public.knowledge_sources.content is 'Raw text content for text/faq sources. Extracted text for file/url sources is stored in knowledge_chunks after ingestion.';
