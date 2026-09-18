import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'volt' | 'gold' | 'brand' | 'lilac'

const toneClasses: Record<Tone, { chip: string; value: string }> = {
  volt: { chip: 'bg-volt-50 text-volt-600', value: 'text-slate-900' },
  gold: { chip: 'bg-gold-50 text-gold-600', value: 'text-slate-900' },
  brand: { chip: 'bg-brand-50 text-brand-600', value: 'text-slate-900' },
  lilac: { chip: 'bg-lilac-100 text-lilac-600', value: 'text-slate-900' },
}

/** One number with a label. Used across dashboard, progress and admin. */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone = 'volt',
  className,
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  hint?: string
  tone?: Tone
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            aria-hidden
            className={clsx(
              'flex h-8 w-8 items-center justify-center rounded-xl',
              toneClasses[tone].chip,
            )}
          >
            {icon}
          </span>
        )}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 break-words">
          {label}
        </p>
      </div>
      <p className={clsx('mt-2 font-display text-2xl font-extrabold', toneClasses[tone].value)}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}
