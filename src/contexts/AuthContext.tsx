import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export interface AppUser {
  id: string
  email: string
}

interface AuthContextType {
  user: AppUser | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean
  isDemoMode: boolean
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const DEMO_USER: AppUser = {
  id: 'demo-user',
  email: 'demo@kairos.local',
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function ensureProfile(user: AppUser) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
  })

  if (error) {
    throw error
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<AppUser | null>(configured ? null : DEMO_USER)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(configured)

  useEffect(() => {
    const supabase = getSupabaseClient()

    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setIsLoading(false)
        return
      }

      setSession(data.session)
      if (data.session?.user.email) {
        const nextUser = {
          id: data.session.user.id,
          email: data.session.user.email,
        }
        setUser(nextUser)
        await ensureProfile(nextUser)
      }
      setIsLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user.email) {
        const nextUser = {
          id: nextSession.user.id,
          email: nextSession.user.email,
        }
        setUser(nextUser)
        void ensureProfile(nextUser)
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [configured])

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    isLoading,
    isConfigured: configured,
    isDemoMode: !configured,
    async signInWithEmail(email: string) {
      const supabase = getSupabaseClient()
      if (!supabase) {
        return
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        throw error
      }
    },
    async signOut() {
      const supabase = getSupabaseClient()
      if (!supabase) {
        return
      }

      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }
    },
  }), [configured, isLoading, session, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
