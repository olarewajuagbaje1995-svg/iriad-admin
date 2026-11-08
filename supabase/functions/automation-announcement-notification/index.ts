import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * automation-announcement-notification
 *
 * Phase 3 native backup engine — announcement notifications.
 *
 * Notifies organisation staff about newly published announcements they have
 * not yet read.
 *
 * Idempotent: same idempotency_key won't re-notify for the same announcement batch.
 *
 * Expects POST body: { job: { ... } }
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

    // Find recently published announcements (last 24h) not yet acknowledged by staff
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: announcements, error: annError } = await supabase
      .from("announcements")
      .select("id, title, body, published_at, created_by")
      .eq("organisation_id", orgId)
      .eq("is_published", true)
      .gte("published_at", yesterday);

    if (annError) throw annError;

    let notified = 0;

    for (const ann of announcements ?? []) {
      // Staff who haven't read this announcement yet
      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("profile_id")
        .eq("announcement_id", ann.id);

      const readIds = new Set((reads ?? []).map((r: any) => r.profile_id));

      const { data: staff } = await supabase
        .from("profiles")
        .select("id")
        .eq("organisation_id", orgId)
        .eq("is_active", true);

      const unreadStaff = (staff ?? []).filter((s: any) => !readIds.has(s.id));

      if (unreadStaff.length > 0) {
        await supabase.from("notifications").insert(
          unreadStaff.map((s: any) => ({
            organisation_id: orgId,
            recipient_id: s.id,
            actor_id: ann.created_by || null,
            type: "announcement",
            title: "New announcement",
            body: ann.title,
            link: `/announcements/${ann.id}`,
            created_at: now,
          }))
        );
        notified += unreadStaff.length;
      }
    }

    await supabase.from("automation_runs").insert({
      organisation_id: orgId,
      workflow_name: "automation-announcement-notification",
      trigger: "schedule",
      status: "completed",
      completed_at: now,
      input: {},
      output: { announcements: (announcements ?? []).length, notified },
    });

    // Mark idempotency completed
    await supabase.from("automation_idempotency").upsert({
      idempotency_key: job.idempotency_key,
      business_operation: job.business_operation,
      organisation_id: orgId,
      status: "completed",
      result: { announcements: (announcements ?? []).length, notified },
      completed_at: now,
    }, { onConflict: "idempotency_key" });

    return json({ ok: true, announcements: (announcements ?? []).length, notified });
  } catch (err) {
    console.error("announcement-notification error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
