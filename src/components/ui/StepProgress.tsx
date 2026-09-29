import clsx from 'clsx'

/**
 * Progress through a fixed sequence of steps.
 *
 * The lesson used to show this as a coloured bar and nothing else, which
 * meant a learner using a screen reader had no way to tell where in the
 * lesson they were, and a learner who cannot distinguish the fill colour
 * from the track had the same problem. Both are fixed the same way: the
 * bar carries real progressbar semantics, and the position is also stated
 * in words next to it.
 *
 * `label` is the spoken and printed form ("Step 3 of 6") and is supplied by
 * the caller so this component owns no copy of its own.
 */
export function StepProgress({
  current,
  total,
  label,
  className,
}: {
  /** 1-based. */
  current: number
  total: number
  label: string
  className?: string
}) {
  const safeTotal = Math.max(total, 1)
  const clamped = Math.min(Math.max(current, 1), safeTotal)
  const percent = (clamped / safeTotal) * 100

  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={clamped}
        aria-valuetext={label}
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* Stated as well as drawn -- state is never carried by colour alone. */}
      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
        {label}
      </span>
    </div>
  )
}
