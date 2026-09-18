import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

type Variant = 'volt' | 'outline' | 'light' | 'quiet'
type Size = 'md' | 'lg'

/**
 * CTA buttons for the public site.
 *
 * Deliberately separate from `components/ui/Button`, which the learner app,
 * parent dashboard and admin all depend on. The marketing site wants a
 * different shape, weight and colour language, and this keeps that entirely
 * out of the product's blast radius.
 */
const variantClasses: Record<Variant, string> = {
  // The single primary action on the site: start the free trial.
  volt: [
    'bg-volt-400 text-ink-950 font-extrabold',
    'shadow-[0_10px_30px_-8px_var(--color-volt-500)]',
    'hover:bg-volt-300 hover:shadow-[0_14px_38px_-8px_var(--color-volt-400)]',
    'active:bg-volt-500',
  ].join(' '),
  // Secondary action on a dark background.
  outline: 'border-2 border-ink-200/25 bg-white/5 text-white hover:bg-white/10 hover:border-ink-200/40',
  // Secondary action on a light background.
  light: 'border-2 border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  quiet: 'text-ink-100 hover:text-white',
}

const sizeClasses: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base',
  // 56px tall: comfortably thumb-reachable, which is how most of this
  // audience will actually see the site.
  lg: 'min-h-14 px-7 text-lg',
}

interface Props {
  children: ReactNode
  to?: string
  href?: string
  variant?: Variant
  size?: Size
  className?: string
  onClick?: () => void
}

export function MarketingButton({
  children,
  to,
  href,
  variant = 'volt',
  size = 'lg',
  className,
  onClick,
}: Props) {
  const classes = clsx(
    'inline-flex items-center justify-center gap-2 rounded-2xl tracking-tight',
    'font-bold transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300/70',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  )
}
