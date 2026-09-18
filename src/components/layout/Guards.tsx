import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLearner } from '@/context/LearnerContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoading />
  if (!session) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export function RequireLearner({ children }: { children: ReactNode }) {
  const { learners, loading } = useLearner()
  if (loading) return <FullScreenLoading />
  if (learners.length === 0) return <Navigate to="/onboarding/learner" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  if (authLoading || adminLoading) return <FullScreenLoading />
  if (!session) return <Navigate to="/sign-in" replace />
  if (!isAdmin) return <Navigate to="/app" replace />
  return <>{children}</>
}

/** Also the Suspense fallback for lazily loaded routes in App.tsx. */
export function FullScreenLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="app-canvas flex min-h-dvh items-center justify-center"
    >
      <span
        aria-hidden
        className="h-10 w-10 animate-spin rounded-full border-4 border-volt-100 border-t-volt-500"
      />
      {/* The spinner is the whole screen while auth resolves, so it needs a
          name -- otherwise a screen reader lands on an empty page. */}
      <span className="sr-only">Loading</span>
    </div>
  )
}
