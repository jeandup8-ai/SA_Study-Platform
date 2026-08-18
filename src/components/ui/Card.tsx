import type { HTMLAttributes } from 'react'
import clsx from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function PressableCard({
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { onClick?: () => void }) {
  return (
    <button
      type="button"
      className={clsx(
        'w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm',
        'transition active:scale-[0.98] active:bg-slate-50',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300',
        className,
      )}
      {...props}
    />
  )
}
