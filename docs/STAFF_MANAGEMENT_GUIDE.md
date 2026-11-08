# IRIAD Operations Portal — Staff Management Guide

Staff management lives at `/app/staff` (`StaffPage.tsx`) and is restricted to `admin` and `director` roles via `isAdminOrDirector`.

---

## Features

### Staff directory table

Lists all profiles with: name, email, department, role, status, and actions.

- **Role dropdown:** Staff / Director / Admin (3-role system)
- **Status badge:** Active / Inactive
- **Deactivate / Reactivate:** toggles `is_active` on the profile
- **Delete:** removes the profile record

### Role changes

Only an `admin` can assign the `admin` or `director` role. A `director` can assign `staff` only. The `canManage(role, targetRole)` helper enforces: admin/director may manage staff, but neither can promote/demote to admin/director.

Every role change is written to the `staff_audit_log` table (action: `role_changed`).

### Create staff account

Opens a modal collecting: full name, email, password, role, department.

- Creates the Supabase Auth user via `supabase.auth.admin.createUser`
- Inserts a matching `profiles` row
- Writes an audit entry (action: `created`)
- Only admins can create admin/director accounts

### Audit log

The `staff_audit_log` table records: staff affected, action (`created`, `role_changed`, `deactivated`, `reactivated`), new value, and timestamp — with the actor's name joined from `profiles`.

---

## Permissions matrix

| Action | Admin | Director | Staff |
|--------|-------|----------|-------|
| View staff directory | ✅ | ✅ | ❌ |
| Change role to staff | ✅ | ✅ | ❌ |
| Change role to director/admin | ✅ | ❌ | ❌ |
| Deactivate/reactivate | ✅ | ✅ | ❌ |
| Delete staff | ✅ | ✅ | ❌ |
| Create staff account | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ❌ |

---

## Security notes

- Staff management is frontend-gated by role; Supabase RLS on `profiles` and `staff_audit_log` provides the server-side enforcement boundary.
- Account creation via Supabase Auth admin API requires service-level privileges — ensure the Edge Function or admin client is configured with appropriate credentials before enabling live account creation.
- The `staff_audit_log` table must exist (migration) for audit entries to be written; the page degrades gracefully if it is not yet applied.
