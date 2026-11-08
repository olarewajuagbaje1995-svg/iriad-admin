import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Treat Supabase as configured only when real (non-placeholder) credentials are present.
// A placeholder publishable key produces a 401 "Invalid API key" from Supabase, so we
// must not pretend the client is usable when it isn't.
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) && !supabaseAnonKey.includes('REPLACE_WITH')

// The client is always defined so existing `supabase.from(...)` call sites keep working.
// When credentials are placeholder/unreal, calls fail at the network layer (caught by
// each caller's try/catch) instead of crashing at import time. Auth is handled by
// useAuth/demoAuth, never by calling supabase.auth directly from UI code.
// Never expose the Supabase secret/service-role key in frontend code.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Organisation = Database['public']['Tables']['organisations']['Row']
