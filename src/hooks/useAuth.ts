import { useEffect, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { demoSignIn, demoSignOut, demoGetProfile } from '@/lib/demoAuth'

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (DEMO_MODE) {
      setProfile(await demoGetProfile())
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      setProfile(null)
      setLoading(false)
      return
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setProfile(prof ?? null)
    setLoading(false)
  }, [DEMO_MODE])

  useEffect(() => {
    loadProfile()
    // Only subscribe to Supabase auth state changes when not in demo mode.
    if (DEMO_MODE) return
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        loadProfile()
      }
    })
    return () => sub?.subscription.unsubscribe?.()
  }, [loadProfile, DEMO_MODE])

  const signIn = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      const { profile, error } = await demoSignIn(email, password)
      setProfile(profile ?? null)
      return { error: error ?? null }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error: error?.message ?? null }
  }, [DEMO_MODE])

  const signOut = useCallback(async () => {
    if (DEMO_MODE) {
      await demoSignOut()
      setProfile(null)
      return { error: null }
    }
    return supabase.auth.signOut()
  }, [DEMO_MODE])

  return {
    profile,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!profile,
    demoMode: DEMO_MODE,
    supabaseConfigured: isSupabaseConfigured,
  }
}
