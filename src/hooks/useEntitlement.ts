import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * Whether this parent may use the paid product.
 *
 * This is a *mirror* of the real gate, not the gate itself. The authority
 * is `internal.has_paid_access()`, enforced by RESTRICTIVE row-level
 * security on the teaching-content tables, so a learner without
 * entitlement reads zero lessons and zero questions no matter what this
 * hook returns or what anyone edits in devtools. What it buys is the
 * difference between a mysteriously empty app and a screen that explains
 * itself and offers the trial.
 *
 * The same function backs both, so the UI and the database cannot disagree
 * about who is entitled.
 */
export function useEntitlement(): { entitled: boolean | null; loading: boolean } {
  const { session, loading: authLoading } = useAuth()
  // null means "not known yet" and is deliberately distinct from false:
  // rendering the upgrade screen while the answer is still in flight would
  // flash a paywall at a parent who is perfectly entitled.
  const [entitled, setEntitled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!session) {
      setEntitled(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase.rpc('has_paid_access').then(({ data, error }) => {
      if (cancelled) return
      // On error, fail closed in the UI. RLS has already failed closed in
      // the database, so claiming entitlement here would only produce an
      // app that looks unlocked and returns nothing.
      setEntitled(error ? false : Boolean(data))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session, authLoading])

  return { entitled, loading }
}
