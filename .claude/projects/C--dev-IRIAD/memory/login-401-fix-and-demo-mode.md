---
name: login-401-fix-and-demo-mode
description: Root cause and fix plan for Supabase 401 "Invalid API key" login error plus VITE_DEMO_MODE demo authentication
metadata:
  type: project
---

## Root cause
- `.env` sets `VITE_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_CURRENT_PUBLISHABLE_KEY` — a placeholder, not a real key.
- `src/lib/supabase.ts` builds the Supabase client with it, so `signInWithPassword()` → 401 "Invalid API key".
- `KNOWN_ISSUES.md`: no real Supabase credentials; auth is placeholder-gated. No real database/migrations applied.

## Fix plan
1. `src/lib/supabase.ts`: remove throw-on-missing-env; always define `supabase`; export `isSupabaseConfigured` (false when placeholder). Never expose service-role key.
2. `src/lib/demoAuth.ts` (new): 4 demo accounts (one per role) + localStorage session; signIn/signOut/getProfile.
3. `src/hooks/useAuth.ts`: when `VITE_DEMO_MODE===true` use demoAuth, else Supabase auth; no silent fallback.
4. `src/features/auth/LoginPage.tsx`: use useAuth.signIn; show demo-mode banner + all four demo credentials.
5. `src/routes/ProtectedRoute.tsx`: use useAuth for session (works in demo mode); spinner during load.
6. `.env`: add `VITE_DEMO_MODE=true`. `.env.example`: document `VITE_DEMO_MODE`.

## Demo accounts (4, one per role)
- ceo@iriad.example / ceo123 → ceo
- admin@iriad.example / admin123 → staff_admin
- superadmin@iriad.example / superadmin123 → super_admin
- staff@iriad.example / staff123 → staff

## Verification (COMPLETE)
- tsc --noEmit clean
- vite build clean
- Dev server running at http://localhost:5173 (PID bivs3az3q)
- Real Supabase auth still requires valid credentials (no silent demo fallback)
- Logout fixed to call signOut() (clears demo localStorage + Supabase session)
