import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'brand' | 'sun' | 'coral' | 'success' | 'warning' | 'danger' | 'neutral'

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-800',
  sun: 'bg-sun-100 text-sun-600',
  coral: 'bg-coral-100 text-coral-500',
  success: 'bg-success-50 text-success-600',
  warning: 'bg-warning-50 text-warning-600',
  danger: 'bg-danger-50 text-danger-600',
  neutral: 'bg-slate-100 text-slate-600',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}
