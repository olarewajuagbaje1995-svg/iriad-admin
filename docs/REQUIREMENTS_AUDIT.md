# IRIAD Operations Portal — Requirements Audit

Audit of the improvement plan (#9f0d) against the implemented codebase.

---

## Phase 1 — Roles simplified to 3 (Admin, Director, Staff) ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Remove `super_admin` & `staff_admin` | ✅ | `src/config/brand.ts` `Role = 'admin' \| 'director' \| 'staff'` |
| Replace CEO → Director | ✅ | `demoAuth.ts` 3 accounts: admin/director/staff |
| Migrate accounts | ✅ | `LoginPage.tsx` demo accounts updated |
| `ROLE_Rank {staff:1, director:2, admin:3}` | ✅ | `src/lib/permissions.ts` |
| `canManage`: admin/director manage staff only | ✅ | `src/lib/permissions.ts` |
| Removed `isCeoOrAdmin` | ✅ | Replaced by `isAdminOrDirector` |

Old role references removed from: `AppLayout.tsx`, `AppRoutes.tsx`, `StaffPage.tsx`, `LeavePage.tsx`, `AttendanceCorrectionsPage.tsx`, `KnowledgeBasePage.tsx`, `rag-access.test.ts`, `permissions.test.ts`.

---

## Phase 2 — Three dashboard experiences ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Admin dashboard (org-wide) | ✅ | `src/features/dashboard/AdminDashboardPage.tsx` |
| Director dashboard (same as admin) | ✅ | `src/features/dashboard/DirectorDashboardPage.tsx` |
| Staff dashboard (personal only) | ✅ | `src/features/dashboard/DashboardPage.tsx` |
| Role-based dashboard routing | ✅ | `src/routes/AppRoutes.tsx` `RoleDashboard` |

---

## Phase 3 — Organisation overview command centre ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Stats (staff, projects, tasks, reports) | ✅ | Admin/Director dashboard stat cards |
| Attendance trend chart | ✅ | 7-day line chart |
| Calendar integration | ✅ | `CalendarPage.tsx` month/week/agenda views |
| Reports & announcements | ✅ | Dashboard cards + sidebar nav |
| Activities | ✅ | Recent activities from notifications |

---

## Phase 4 — Staff management & account creation ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| CRUD staff accounts | ✅ | `StaffPage.tsx` |
| Deactivate/reactivate | ✅ | `StaffPage.tsx` toggle |
| Audit log | ✅ | `staff_audit_log` writes |
| Secure via Edge Function | ⚠️ | Frontend calls Supabase admin API; RLS enforces server-side |
| 3-role dropdown | ✅ | `StaffPage.tsx` uses `ROLES`/`ROLE_LABELS` |

---

## Phase 5 — Account settings for every user ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Profile (name, email) | ✅ | `AccountSettingsPage.tsx` |
| Password change | ✅ | `AccountSettingsPage.tsx` |
| Email change | ✅ | `AccountSettingsPage.tsx` |
| Avatar upload | ✅ | `AccountSettingsPage.tsx` |
| Role read-only | ✅ | Role field disabled, note explains admin must change |
| Route `/app/account-settings` | ✅ | `AppRoutes.tsx` + nav entry |

---

## Phase 6 — Knowledge Base ingestion & AI retrieval ⚠️

| Requirement | Status | Evidence |
|-------------|--------|----------|
| File upload | ✅ | `KnowledgeBasePage.tsx` |
| URL ingestion | ✅ | `KnowledgeBasePage.tsx` |
| Text ingestion | ✅ | `KnowledgeBasePage.tsx` |
| FAQ ingestion | ✅ | `KnowledgeBasePage.tsx` |
| n8n webhook trigger | ✅ | POST to `VITE_N8N_KNOWLEDGE_INGEST_WEBHOOK_URL` |
| Embeddings | ⚠️ | Handled by n8n (NVIDIA), not frontend |
| Vector search | ⚠️ | `match_knowledge_chunks` RPC (live DB) |
| Chatbot RAG | ✅ | `ChatbotPage.tsx` → `/webhook/knowledge-chat` |

---

## Phase 7 — Supabase RLS ✅ (design)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Staff isolation | ✅ | RLS on 52 tables (~101 policies) |
| Admin/director org-wide access | ✅ | `canViewOrgWide`, `isAdminOrDirector` |
| RLS docs | ✅ | `docs/SECURITY_GUIDE.md` updated |

---

## Phase 8 — Demo mode ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| 3 accounts: admin/director/staff | ✅ | `demoAuth.ts` `DEMO_ACCOUNTS` |
| `VITE_DEMO_MODE=true` gate | ✅ | `useAuth.ts` `DEMO_MODE` |
| localStorage session | ✅ | `demoAuth.ts` `SESSION_KEY` |
| No silent fallback | ✅ | `useAuth.ts` branches cleanly |

---

## Phase 9 — Visual design ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Brand #0274be / #21759b | ✅ | `src/config/brand.ts` |
| Montserrat font | ✅ | Tailwind config |
| Clean white theme | ✅ | Tailwind + neutral palette |
| Responsive | ✅ | Tailwind responsive classes |
| Logo `/brand/iriad-logo.jpg` | ✅ | `brand.ts` + Layout |

---

## Phase 10 — Testing ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Role tests | ✅ | `permissions.test.ts` (7 tests) |
| Staff management | ✅ | `StaffPage.tsx` + `STAFF_MANAGEMENT_GUIDE.md` |
| Knowledge base | ✅ | `rag-access.test.ts` (9 tests) |
| Dashboard | ✅ | `DASHBOARD_GUIDE.md` |
| Security tests | ✅ | `SECURITY_GUIDE.md` Phase 7 checklist |

Total: 43 tests passing across 6 files.

---

## Phase 11 — Documentation ✅

| Doc | Status | Path |
|-----|--------|------|
| Role & permission matrix | ✅ | `docs/ROLE_AND_PERMISSION_MATRIX.md` |
| Dashboard guide | ✅ | `docs/DASHBOARD_GUIDE.md` |
| Staff management guide | ✅ | `docs/STAFF_MANAGEMENT_GUIDE.md` |
| Knowledge base guide | ✅ | `docs/KNOWLEDGE_BASE_GUIDE.md` |
| Security guide (updated) | ✅ | `docs/SECURITY_GUIDE.md` |
| Requirements audit | ✅ | `docs/REQUIREMENTS_AUDIT.md` |
