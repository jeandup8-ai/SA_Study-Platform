import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * The top of an application screen. One component so every screen has the
 * same rhythm: a small uppercase eyebrow naming where you are, a display
 * title, an optional supporting line, and a slot for actions on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={clsx('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-volt-600">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 break-words">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A labelled band within a screen. Matches the marketing SectionHeading rhythm. */
export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex items-baseline justify-between gap-3', className)}>
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{children}</h2>
      {action}
    </div>
  )
}
