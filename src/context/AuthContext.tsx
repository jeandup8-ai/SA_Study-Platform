import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { applyLanguagePreference } from '@/i18n'
import type { Parent } from '@/types/curriculum'

interface AuthContextValue {
  session: Session | null
  user: User | null
  parent: Parent | null
  loading: boolean
  signUp: (params: {
    fullName: string
    email: string
    password: string
  }) => Promise<{ requiresEmailConfirmation: boolean }>
  signIn: (params: { email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  refreshParent: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [parent, setParent] = useState<Parent | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadParent(userId: string) {
    const { data } = await supabase.from('parents').select('*').eq('id', userId).maybeSingle()
    setParent(data)
    if (data) applyLanguagePreference(data.preferred_language)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadParent(data.session.user.id)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        void loadParent(newSession.user.id)
      } else {
        setParent(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signUp({
    fullName,
    email,
    password,
  }: {
    fullName: string
    email: string
    password: string
  }): Promise<{ requiresEmailConfirmation: boolean }> {
    // The `parents` row is created server-side by a trigger on auth.users (see
    // migration 0012) — never inserted from here. Doing it client-side would
    // require an active session at this exact moment, which doesn't exist yet
    // when the project requires email confirmation (the default).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    if (!data.user) throw new Error('Sign up did not return a user.')

    if (data.session) {
      await loadParent(data.user.id)
      return { requiresEmailConfirmation: false }
    }
    return { requiresEmailConfirmation: true }
  }

  async function signIn({ email, password }: { email: string; password: string }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setParent(null)
  }

  async function refreshParent() {
    if (session) await loadParent(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        parent,
        loading,
        signUp,
        signIn,
        signOut,
        refreshParent,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
