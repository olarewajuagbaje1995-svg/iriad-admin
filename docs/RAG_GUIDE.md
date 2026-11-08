# IRIAD Operations Portal — RAG Guide

**Status:** RAG schema and chatbot page built; knowledge ingestion UI and live NVIDIA/n8n integration pending.

## 1. Architecture

```
user question (Chatbot page)
   │ POST webhook /knowledge-chat
   ▼
n8n knowledge-chat-agent
   ├─ AI Agent (NVIDIA NIM nemotron) + system prompt
   ├─ Vector search: match_knowledge_chunks (pgvector, vector(1536))
   └─ save reply to chatbot_messages
   ▼
answer + citations back to Chatbot page
```

## 2. Database tables (RAG)

| Table | Purpose |
|-------|---------|
| `knowledge_collections` | grouped collections of sources |
| `knowledge_sources` | documents/URLs/FAQs to ingest (`indexed` flag) |
| `knowledge_chunks` | text chunks + `embedding` vector(1536) |
| `ingestion_jobs` | ingestion run status |
| `chatbot_conversations` | conversation sessions |
| `chatbot_messages` | user/assistant messages |
| `chatbot_feedback` | user thumbs up/down on answers |

## 3. Embeddings & search

- Embedding dimension: **1536** (NVIDIA embedding model).
- Column: `knowledge_chunks.embedding` → `vector(1536)`.
- Similarity search: `match_knowledge_chunks` RPC (cosine distance), returns top-k matching chunks.
- Chunks are scoped to sources/collections; RLS filters by organisation so staff only see chunks their org can access.

## 4. Ingestion flow (knowledge-ingestion workflow)

1. Register a source in `knowledge_sources` (title, URL or file).
2. Extract text, chunk it, compute embeddings (NVIDIA).
3. Insert chunks into `knowledge_chunks` with embeddings.
4. Mark source `indexed = true`.

## 5. Chat flow (knowledge-chat-agent workflow)

1. Webhook receives user question + session id.
2. AI Agent embeds the question, calls `match_knowledge_chunks` for context.
3. NVIDIA nemotron answers using only the provided context.
4. Reply saved to `chatbot_messages`; answer + citations returned.

## 6. Access control

- RLS on `knowledge_chunks`/`knowledge_sources` filters by `organisation_id`.
- Staff cannot retrieve admin-only knowledge chunks.
- Prompt injection resistance: system message constrains the agent to the provided context.

## 7. What is NOT yet operational

- Knowledge-base source ingestion UI (not built)
- File/URL ingestion + text extraction pipeline
- Live NVIDIA_API_KEY configured (placeholder only)
- n8n knowledge-chat-agent imported and activated
- `/.netlify/functions/chatbot-query` endpoint wired to n8n (currently placeholder)

## 8. Before claiming RAG is operational

- [ ] `NVIDIA_API_KEY` set in local `.env`
- [ ] `knowledge-ingestion` and `knowledge-chat-agent` imported into n8n
- [ ] At least one source ingested with embeddings in `knowledge_chunks`
- [ ] End-to-end chat returns a grounded answer with citations
- [ ] RAG access restriction verified (staff vs admin chunks)
