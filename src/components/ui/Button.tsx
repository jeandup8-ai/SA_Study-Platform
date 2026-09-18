import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'volt'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-brand-700 border-2 border-brand-200 hover:bg-brand-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-danger-500 text-white hover:bg-danger-600',
  // Matches the marketing site's primary CTA, for the few places in the app
  // that are continuous with it -- upgrade, start trial, generation runs.
  volt: 'bg-volt-500 text-ink-950 hover:bg-volt-400 active:bg-volt-600',
}

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-5 text-base',
  lg: 'min-h-14 px-7 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'lg', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold',
          'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
