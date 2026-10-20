import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ProviderStatus, VerificationStatus } from '../../../shared/types'
import { api, ApiError } from '../api'

export const RADIUS_NOTICE =
  'All included attractions are within 50 km straight-line distance of your confirmed stay. Driving distances and travel times may be longer.'

// ------------------------------------------------------------ status

const StatusContext = createContext<ProviderStatus | null>(null)
export const useStatus = () => useContext(StatusContext)

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  useEffect(() => {
    api.status().then(setStatus, () => setStatus(null))
  }, [])
  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
}

// ----------------------------------------------------------- notices

export function RadiusNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`flex gap-3 rounded-2xl bg-sea-soft text-sea-deep ${compact ? 'p-3 text-sm' : 'p-4'}`}
      role="note"
    >
      <RingIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{RADIUS_NOTICE}</span>
    </p>
  )
}

export function SampleBanner({ what = 'This uses' }: { what?: string }) {
  return (
    <p
      className="rounded-2xl border border-amber-ink/20 bg-amber-soft p-3 text-sm text-amber-ink"
      role="note"
    >
      <strong>Sample data.</strong> {what} a fictional destination, Kestrel Bay, and
      fictional places, for demonstration only. None of it describes a real location.
    </p>
  )
}

export function ErrorNotice({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const message =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : 'Something went wrong.'
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-coral-soft p-4 text-coral"
    >
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary !border-coral !text-coral"
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-6 text-muted">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-sea border-t-transparent motion-reduce:animate-none"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="font-display text-xl">{title}</p>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  )
}

// ------------------------------------------------------------ badges

const VERIFICATION: Record<
  VerificationStatus,
  { label: string; cls: string; title: string }
> = {
  VERIFIED_SOURCE: {
    label: 'Verified',
    cls: 'bg-sea-soft text-sea-deep',
    title: 'Confirmed against a cited source',
  },
  PROVIDER_LISTED: {
    label: 'Provider listed',
    cls: 'bg-sand text-ink',
    title: 'As listed by the data provider; not independently checked',
  },
  ESTIMATED: {
    label: 'Estimate',
    cls: 'bg-amber-soft text-amber-ink',
    title: 'An estimate, not a confirmed fact',
  },
  UNVERIFIED: {
    label: 'Not verified',
    cls: 'bg-coral-soft text-coral',
    title: 'Not enough evidence to confirm',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    cls: 'bg-coral-soft text-coral',
    title: 'The source could not be checked',
  },
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFICATION[status]
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}
      title={v.title}
    >
      {v.label}
    </span>
  )
}

export function SampleTag() {
  return (
    <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber-ink">
      Sample
    </span>
  )
}

export function RingIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="2.5 2.5" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title
      ? `${title} · StayScout`
      : 'StayScout — plan around where you’re staying'
  }, [title])
}

/** Private pages shouldn't be indexed even if a link leaks. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
