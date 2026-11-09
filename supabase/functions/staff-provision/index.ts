import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey);

const VALID_ROLES = ["admin", "director", "staff"] as const;
type Role = (typeof VALID_ROLES)[number];

function nowLagos(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

/**
 * Authenticate the caller from the Bearer JWT in the request.
 * Returns the caller's profile and organisation, or throws a 401/403.
 */
async function authenticateCaller(req: Request) {
  const authHeader = req.headers.get("Authorization");
  console.log("[staff-provision] Authorization header present:", !!authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[staff-provision] Missing or malformed Authorization header");
    throw new Error("Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  console.log("[staff-provision] JWT verification result:", { userId: user?.id, error: userError?.message });
  if (userError || !user) {
    console.log("[staff-provision] JWT verification failed:", userError?.message);
    throw new Error("Unauthorized: invalid session");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role, organisation_id, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.log("[staff-provision] Profile lookup failed:", profileError?.message);
    throw new Error("Forbidden: caller profile not found");
  }

  if (profile.is_active === false) {
    throw new Error("Forbidden: caller account is deactivated");
  }

  return {
    callerId: profile.id as string,
    callerRole: (profile.role as Role | null) ?? null,
    callerOrgId: profile.organisation_id as string | null,
  };
}

/**
 * Check whether the caller is permitted to assign the given target role to a new account.
 * Admin can assign admin/director/staff. Director can assign staff only. Staff cannot assign anything.
 */
function canAssignRole(callerRole: Role | null, targetRole: Role): boolean {
  if (!VALID_ROLES.includes(targetRole)) return false;
  if (callerRole === "admin") return true;
  if (callerRole === "director") return targetRole === "staff";
  return false;
}

/**
 * Check whether the caller is permitted to change the role of an existing account.
 * Same rules as canAssignRole, plus Staff cannot modify their own role.
 */
function canChangeRole(
  callerRole: Role | null,
  callerId: string,
  targetId: string,
  targetRole: Role,
): boolean {
  if (!canAssignRole(callerRole, targetRole)) return false;
  if (callerRole !== "admin" && callerRole !== "director") return false;
  if (callerId === targetId) return false; // cannot modify own role
  return true;
}

/**
 * Check whether the caller can manage (deactivate/reactivate) a target account.
 */
function canManageAccount(
  callerRole: Role | null,
  callerId: string,
  targetId: string,
): boolean {
  if (callerRole !== "admin" && callerRole !== "director") return false;
  if (callerId === targetId) return false; // cannot deactivate self
  return true;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let caller: { callerId: string; callerRole: Role | null; callerOrgId: string | null };
  try {
    caller = await authenticateCaller(req);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 401);
  }

  const { callerId, callerRole, callerOrgId } = caller;

  let body: { action?: string; email?: string; fullName?: string; role?: Role; departmentId?: string; targetUserId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body" }, 400);
  }

  const { action, email, fullName, role, departmentId, targetUserId } = body;

  // =========================================================
  // ACTION: create — invite a new staff account
  // =========================================================
  if (action === "create") {
    if (!email || typeof email !== "string") {
      return json({ ok: false, error: "Email is required" }, 400);
    }
    if (!fullName || typeof fullName !== "string") {
      return json({ ok: false, error: "Full name is required" }, 400);
    }

    const targetRole: Role = (role ?? "staff") as Role;
    if (!VALID_ROLES.includes(targetRole)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }

    // Permission: only admin/director can create accounts
    if (callerRole !== "admin" && callerRole !== "director") {
      return json({ ok: false, error: "Only Admin or Director can create staff accounts" }, 403);
    }

    // Permission: role assignment rules
    if (!canAssignRole(callerRole, targetRole)) {
      return json(
        { ok: false, error: `${callerRole} cannot assign the ${targetRole} role` },
        403,
      );
    }

    // Organisation isolation: can only create accounts in caller's organisation
    if (!callerOrgId) {
      return json({ ok: false, error: "Caller has no organisation" }, 403);
    }

    // Duplicate prevention: check if a profile already exists for this email
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, is_active")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      return json(
        { ok: false, error: "A profile already exists for this email address" },
        409,
      );
    }

    // Check if an auth user already exists for this email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return json({ ok: false, error: "Failed to check existing accounts" }, 500);
    }

    const existingAuthUser = users?.find((u) => u.email?.toLowerCase() === email.toLowerCase().trim());
    if (existingAuthUser) {
      return json(
        { ok: false, error: "An auth account already exists for this email address" },
        409,
      );
    }

    // Create the auth user with a default password so the new staff member can
    // log in immediately. The email is auto-confirmed; no invitation email is sent.
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: "IRIAD2026!",
      email_confirm: true,
      user_metadata: { full_name: fullName.trim(), role: targetRole },
    });

    if (createError || !createData.user) {
      console.log("[staff-provision] createUser failed:", createError?.message ?? createError);
      return json(
        { ok: false, error: createError?.message ?? "Failed to create user" },
        400,
      );
    }

    const newUserId = createData.user.id;

    // Create the corresponding profiles record using the actual Auth user ID
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      organisation_id: callerOrgId,
      department_id: departmentId || null,
      email: email.toLowerCase().trim(),
      full_name: fullName.trim(),
      role: targetRole,
      is_active: true,
    });

    if (profileError) {
      // Safe compensation: delete the orphaned auth user so we don't leave
      // an account with no profile
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => {
        /* best-effort cleanup */
      });
      return json({ ok: false, error: profileError.message ?? "Failed to create profile" }, 400);
    }

    // Write audit entry
    await supabaseAdmin.from("staff_audit_log").insert({
      staff_id: newUserId,
      actor_id: callerId,
      action: "created",
      old_value: null,
      new_value: targetRole,
      organisation_id: callerOrgId,
    });

    return json({
      ok: true,
      userId: newUserId,
      email: inviteData.user.email,
      role: targetRole,
      message: "Invitation sent. The user can set their password via the invitation link.",
    }, 200);
  }

  // =========================================================
  // ACTION: update_role — change a staff member's role
  // =========================================================
  if (action === "update_role") {
    if (!targetUserId || typeof targetUserId !== "string") {
      return json({ ok: false, error: "Target user ID is required" }, 400);
    }

    const targetRole: Role = (role ?? "staff") as Role;
    if (!VALID_ROLES.includes(targetRole)) {
      return json({ ok: false, error: "Invalid role" }, 400);
    }

    // Permission check
    if (!canChangeRole(callerRole, callerId, targetUserId, targetRole)) {
      return json(
        { ok: false, error: "Not permitted to change this user's role" },
        403,
      );
    }

    // Organisation isolation: target must be in caller's organisation
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, organisation_id, is_active")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return json({ ok: false, error: "Target user not found" }, 404);
    }

    if (targetProfile.organisation_id !== callerOrgId) {
      return json({ ok: false, error: "Target user is not in your organisation" }, 403);
    }

    const oldRole = targetProfile.role as Role;

    if (oldRole === targetRole) {
      return json({ ok: false, error: "User already has this role" }, 400);
    }

    // Update the profile role
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: targetRole, updated_at: nowLagos().toISOString() })
      .eq("id", targetUserId);

    if (updateError) {
      return json({ ok: false, error: updateError.message ?? "Failed to update role" }, 400);
    }

    // Write audit entry
    await supabaseAdmin.from("staff_audit_log").insert({
      staff_id: targetUserId,
      actor_id: callerId,
      action: "role_changed",
      old_value: oldRole,
      new_value: targetRole,
      organisation_id: callerOrgId,
    });

    return json({
      ok: true,
      userId: targetUserId,
      email: targetProfile.email,
      oldRole,
      newRole: targetRole,
    }, 200);
  }

  // =========================================================
  // ACTION: deactivate / reactivate — toggle is_active
  // =========================================================
  if (action === "deactivate" || action === "reactivate") {
    if (!targetUserId || typeof targetUserId !== "string") {
      return json({ ok: false, error: "Target user ID is required" }, 400);
    }

    // Permission check
    if (!canManageAccount(callerRole, callerId, targetUserId)) {
      return json(
        { ok: false, error: "Not permitted to change this account's status" },
        403,
      );
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_active, organisation_id")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return json({ ok: false, error: "Target user not found" }, 404);
    }

    if (targetProfile.organisation_id !== callerOrgId) {
      return json({ ok: false, error: "Target user is not in your organisation" }, 403);
    }

    const currentlyActive = targetProfile.is_active !== false;
    const isDeactivate = action === "deactivate";

    if (isDeactivate && !currentlyActive) {
      return json({ ok: false, error: "Account is already deactivated" }, 400);
    }
    if (!isDeactivate && currentlyActive) {
      return json({ ok: false, error: "Account is already active" }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: !isDeactivate,
        updated_at: nowLagos().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      return json(
        { ok: false, error: updateError.message ?? "Failed to update status" },
        400,
      );
    }

    // Write audit entry
    await supabaseAdmin.from("staff_audit_log").insert({
      staff_id: targetUserId,
      actor_id: callerId,
      action: isDeactivate ? "deactivated" : "reactivated",
      old_value: currentlyActive ? "active" : "inactive",
      new_value: !isDeactivate ? "active" : "inactive",
      organisation_id: callerOrgId,
    });

    return json({
      ok: true,
      userId: targetUserId,
      email: targetProfile.email,
      isActive: !isDeactivate,
    }, 200);
  }

  // =========================================================
  // ACTION: delete — hard delete a staff account (Admin only)
  // =========================================================
  if (action === "delete") {
    if (!targetUserId || typeof targetUserId !== "string") {
      return json({ ok: false, error: "Target user ID is required" }, 400);
    }

    // Only Admin can delete accounts
    if (callerRole !== "admin") {
      return json({ ok: false, error: "Only Admin can delete staff accounts" }, 403);
    }

    if (callerId === targetUserId) {
      return json({ ok: false, error: "Cannot delete your own account" }, 403);
    }

    // Organisation isolation: target must be in caller's organisation
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, organisation_id")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return json({ ok: false, error: "Target user not found" }, 404);
    }

    if (targetProfile.organisation_id !== callerOrgId) {
      return json({ ok: false, error: "Target user is not in your organisation" }, 403);
    }

    // Write audit entry before deletion (audit references profiles.id via FK)
    await supabaseAdmin.from("staff_audit_log").insert({
      staff_id: targetUserId,
      actor_id: callerId,
      action: "deleted",
      old_value: targetProfile.role,
      new_value: null,
      organisation_id: callerOrgId,
    });

    // Delete the profile (cascade deletes linked records; auth user deleted separately)
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (deleteError) {
      return json({ ok: false, error: deleteError.message ?? "Failed to delete profile" }, 400);
    }

    // Delete the Auth user so no orphaned account remains
    await supabaseAdmin.auth.admin.deleteUser(targetUserId).catch(() => {
      /* best-effort cleanup; profile is already removed */
    });

    return json({
      ok: true,
      userId: targetUserId,
      email: targetProfile.email,
    }, 200);
  }

  return json({ ok: false, error: "Unknown or missing action" }, 400);
});
