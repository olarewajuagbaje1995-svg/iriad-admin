import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-knowledge-chat
 *
 * Phase 3 native backup engine — knowledge chat handler.
 *
 * Handles knowledge-base chat queries routed from the dispatcher. In the
 * native backup implementation it records the chat interaction and returns
 * a placeholder response indicating the RAG-backed knowledge chat is handled
 * by the primary application layer (or an external provider when configured).
 *
 * Idempotent: same idempotency_key won't re-process the same chat query.
 *
 * Expects POST body: { job: { job_id, idempotency_key, business_operation,
 *   organisation_id, scheduled_at, payload?: { query, staff_id } } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = new Date().toISOString();

    // Idempotency guard
    const { data: idem } = await supabase
      .from("automation_idempotency")
      .select("status")
      .eq("idempotency_key", job.idempotency_key)
      .single();
    if (idem?.status === "completed") {
      return json({ ok: true, skipped: true, reason: "idempotency_completed" });
    }

    const orgId = job.organisation_id;
    const payload = (job as any).payload || {};
    const query = payload.query || "";
    const staffId = payload.staff_id || null;

    // Record the knowledge chat interaction for audit/tracking
    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-knowledge-chat",
      trigger: "event",
      status: "completed",
      completed_at: now,
      input: { query, staff_id: staffId },
      output: { handled_by: "native-backend-placeholder" },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { query_length: query.length, handled_by: "native-backend-placeholder" },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({
      ok: true,
      response: "Knowledge chat is handled by the primary application layer. This native backup recorded the interaction.",
      handled_by: "native-backend-placeholder",
    });
  } catch (err) {
    console.error("knowledge-chat error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
