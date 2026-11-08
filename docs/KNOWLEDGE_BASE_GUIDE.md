# IRIAD Operations Portal — Knowledge Base Guide

The Knowledge Base (`/app/knowledge-base`, `KnowledgeBasePage.tsx`) supports ingestion of file uploads, website URLs, direct text, and FAQ entries, with n8n handling extraction, chunking, embeddings, and vector storage.

---

## Ingestion pipeline

1. **Create source** — admin/director fills the "Add source" form:
   - Source type: Direct text / Website URL / FAQ / File upload
   - Title, description, collection
   - Content (text/URL/FAQ question-answer/file)
   - Audience: All staff / Selected roles / Admin only
   - Allowed roles (when audience = selected roles): staff / director / admin
2. **Store** — a `knowledge_sources` row is inserted with `indexing_status = 'pending'`
3. **File upload** — files are uploaded to Supabase Storage (`documents` bucket) under `knowledge/<orgId>/<file>`
4. **n8n webhook** — POST to `/webhook/knowledge-ingest` triggers extraction, chunking, NVIDIA embeddings, and storage in `knowledge_chunks`
5. **Index** — source marked `indexed` (or `failed` on error)

---

## Supported source types

| Type | Input | Notes |
|------|-------|-------|
| Direct text | textarea | Plain text content |
| Website URL | URL input | Fetched and extracted by n8n |
| FAQ | question + answer | Stored as `Q: ...\nA: ...` |
| File upload | PDF, DOCX, TXT, MD, CSV (max 10 MB) | Stored in Supabase Storage |

---

## Access control

- `all_staff` sources: visible to every role
- `selected_roles` sources: visible only to listed roles (staff/director/admin)
- `admin_only` sources: visible to admin and director only

RAG chat retrieval (`match_knowledge_chunks` RPC) filters chunks by the caller's role — staff cannot retrieve admin-only chunks.

---

## RAG chatbot (`/app/knowledge-assistant`, `ChatbotPage.tsx`)

- POST to `/webhook/knowledge-chat` with question, conversation_id, profile_id
- n8n performs vector search via `match_knowledge_chunks`, generates an NVIDIA-grounded answer with citations, and saves the reply to `chatbot_messages`

---

## Permissions

| Action | Admin | Director | Staff |
|--------|-------|----------|-------|
| View sources | ✅ | ✅ | ✅ |
| Create source | ✅ | ✅ | ❌ |
| Reprocess/delete source | ✅ | ✅ | ❌ |
| Admin-only sources | ✅ | ✅ | ❌ |
| RAG chat | ✅ | ✅ | ✅ (filtered) |
