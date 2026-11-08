import type { Profile } from './supabase'

/**
 * Local demo authentication.
 *
 * Gated entirely by VITE_DEMO_MODE in useAuth — this module is never consulted when
 * real Supabase credentials are configured, so there is no silent fallback to demo
 * when Supabase fails. Session persists in localStorage across page reloads.
 */

export interface DemoAccount {
  id: string
  email: string
  password: string
  full_name: string
  role: 'admin' | 'director' | 'staff'
  organisation_id: string
}

export const DEMO_ORG_ID = '00000000-0000-0000-000000000001'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'demo-00000000-0001',
    email: 'admin@iriad.example',
    password: 'admin123',
    full_name: 'Bala Ibrahim (Admin)',
    role: 'admin',
    organisation_id: DEMO_ORG_ID,
  },
  {
    id: 'demo-00000000-0002',
    email: 'director@iriad.example',
    password: 'director123',
    full_name: 'Ada Nkwocha (Director)',
    role: 'director',
    organisation_id: DEMO_ORG_ID,
  },
  {
    id: 'demo-00000000-0003',
    email: 'staff@iriad.example',
    password: 'staff123',
    full_name: 'Chinwe Okafor (Staff)',
    role: 'staff',
    organisation_id: DEMO_ORG_ID,
  },
]

const SESSION_KEY = 'iriad_demo_session'

interface DemoSession {
  profile: Profile
  createdAt: string
}

export function findAccount(email: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
}

export async function demoSignIn(email: string, password: string): Promise<{
  profile: Profile | null
  error: string | null
}> {
  const account = findAccount(email)
  if (!account || account.password !== password) {
    return { profile: null, error: 'Invalid email or password.' }
  }

  const profile: Profile = {
    id: account.id,
    organisation_id: account.organisation_id,
    department_id: null,
    email: account.email,
    full_name: account.full_name,
    role: account.role,
    avatar_url: null,
    phone: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const session: DemoSession = { profile, createdAt: new Date().toISOString() }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))

  return { profile, error: null }
}

export async function demoSignOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY)
}

export async function demoGetProfile(): Promise<Profile | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { profile } = JSON.parse(raw) as DemoSession
    return profile ?? null
  } catch {
    return null
  }
}
