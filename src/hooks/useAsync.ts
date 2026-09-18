import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AsyncState<T> {
  status: AsyncStatus
  data: T | null
  error: Error | null
  /** Re-runs the loader. Safe to pass straight to an ErrorState retry. */
  reload: () => void
}

/**
 * Runs an async loader and reports loading / success / error as one state.
 *
 * Before this existed, every screen did `fetchThing().then(setThing)` with
 * no catch: a request that failed left the page blank forever, and a
 * request still in flight looked exactly the same as a genuinely empty
 * result. Both are now distinguishable, which is what lets a screen show a
 * skeleton, an empty state and an error state as three different things.
 *
 * `enabled: false` holds the hook at `idle` without running the loader --
 * used where the fetch depends on a learner that has not been resolved
 * yet, so the screen shows a skeleton rather than a spurious error.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): AsyncState<T> {
  const { enabled = true } = options
  const [status, setStatus] = useState<AsyncStatus>(enabled ? 'loading' : 'idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  // Kept in a ref so changing the loader identity between renders (it is an
  // inline closure at almost every call site) does not restart the request.
  // `deps` is what decides when to re-run.
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }
    let cancelled = false
    setStatus('loading')
    setError(null)
    loaderRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { status, data, error, reload }
}
