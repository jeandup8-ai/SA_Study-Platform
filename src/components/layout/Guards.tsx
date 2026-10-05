import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useLearner } from '@/context/LearnerContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useEntitlement } from '@/hooks/useEntitlement'

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

/**
 * The paid product, behind the thing that makes it paid.
 *
 * Teaching content is gated in the database by RESTRICTIVE RLS, so this
 * guard is not what keeps an unpaid visitor out -- `internal.has_paid_access()`
 * is, and it is re-evaluated on every row read. This exists so that being
 * kept out looks like an explanation rather than a fault: without it a
 * parent whose trial lapsed would see subjects with no lessons, questions
 * that never load, and nothing saying why.
 *
 * Deliberately only around /app (the learner experience). /parent stays
 * open, because locking someone out of the screen where they would pay us
 * is the one thing a paywall must never do.
 */
export function RequireEntitlement({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { entitled, loading } = useEntitlement()

  if (loading || entitled === null) return <FullScreenLoading />
  if (entitled) return <>{children}</>

  return (
    <main className="app-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-extrabold text-slate-900">
          {t('entitlement.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('entitlement.body')}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/parent/subscription"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-volt-500 px-6 font-bold text-ink-950 hover:bg-volt-400"
          >
            {t('entitlement.cta')}
          </Link>
          <Link
            to="/practice"
            className="inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            {t('entitlement.freePractice')}
          </Link>
        </div>
      </div>
    </main>
  )
}
