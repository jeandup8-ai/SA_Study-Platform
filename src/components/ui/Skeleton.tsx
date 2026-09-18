import clsx from 'clsx'

/**
 * A placeholder block shown while real content loads.
 *
 * Every skeleton carries `aria-hidden` and the surrounding region is
 * labelled `aria-busy` by the caller, so a screen reader announces "busy"
 * once instead of reading a wall of empty boxes.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton rounded-xl', className)} />
}

/** Matches the shape of a standard `Card` row: icon/ring, two text lines. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx(
        'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-3xl',
        'border border-slate-200 bg-white p-5',
        className,
      )}
    >
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

/**
 * `count` skeleton cards in a labelled busy region. This is the shape most
 * list screens want: one element that is announced once and read as a
 * single loading region rather than N empty rows.
 */
export function SkeletonList({
  count = 3,
  label,
  className,
}: {
  count?: number
  label: string
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={clsx('space-y-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}
