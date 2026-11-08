import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Return the current moment expressed in Africa/Lagos wall-clock time. */
function nowLagos(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }))
}

/**
 * automation-document-notifications
 *
 * Phase 3 native backup engine — document notifications.
 *
 * Notifies organisation staff about newly uploaded documents relevant to them
 * (linked to their projects/tasks or organisation-wide).
 *
 * Idempotent: same idempotency_key won't re-notify for the same document batch.
 *
 * Expects POST body: { job: { ... } }
 */
serve(async (req) => {
  try {
    const { job } = await req.json();
    const now = nowLagos().toISOString();

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

    // Find recently created documents (last 24h)
    const yesterdayLagos = new Date(nowLagos().getTime() - 24 * 60 * 60 * 1000);
    const yesterday = yesterdayLagos.toISOString();

    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, title, category, owner_id, is_public, linked_to_type, linked_to_id, created_at")
      .eq("organisation_id", orgId)
      .gte("created_at", yesterday);

    if (docError) throw docError;

    let notified = 0;

    for (const doc of documents ?? []) {
      // Notify admins and the document owner about new org documents
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("organisation_id", orgId)
        .in("role", ["admin", "director"]);

      const recipients = new Set<string>();
      if (admins) admins.forEach((a: any) => recipients.add(a.id));
      if (doc.owner_id) recipients.add(doc.owner_id);

      if (recipients.size > 0) {
        await supabase.from("notifications").insert(
          Array.from(recipients).map((recipientId) => ({
            organisation_id: orgId,
            recipient_id: recipientId,
            actor_id: doc.owner_id || null,
            type: "chat_message", // document notifications reuse nearest type
            title: "New document uploaded",
            body: `${doc.title}${doc.category ? ` (${doc.category})` : ""}`,
            link: `/documents/${doc.id}`,
            created_at: now,
          }))
        );
        notified += recipients.size;
      }
    }

    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-document-notifications",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: { documents: (documents ?? []).length, notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { documents: (documents ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, documents: (documents ?? []).length, notified });
  } catch (err) {
    console.error("document-notifications error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
