-- Migration 014: Knowledge chunks write policies
-- Adds INSERT/UPDATE/DELETE Row Level Security policies on knowledge_chunks
-- so Admin and Director roles can create, edit, and remove knowledge chunks
-- within their own organisation. Migration 008 only created a SELECT policy.
--
-- Roles are aligned to the frontend three-role structure (admin/director/staff)
-- per migration 011. This migration must run AFTER migration 011.
--
-- REVIEW ONLY — do not apply to production until approved and staged-tested.

-- RLS: chunks — admin/director manage within own organisation
create policy knowledge_chunks_manage_admin on public.knowledge_chunks
  for all using (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  )
  with check (
    organisation_id in (
      select organisation_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles p where p.id = auth.uid()
      and p.role in ('admin','director')
    )
  );
