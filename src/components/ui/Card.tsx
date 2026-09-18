import type { HTMLAttributes } from 'react'
import clsx from 'clsx'
import { cardToneClasses, type CardTone } from './cardTones'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
}

export function Card({ className, tone = 'plain', ...props }: CardProps) {
  return (
    <div
      className={clsx('rounded-3xl border p-5 shadow-sm', cardToneClasses[tone], className)}
      {...props}
    />
  )
}

/**
 * A card that is itself the control. `card-lift` is applied here and only
 * here, so "this surface lifts when you point at it" reliably means "this
 * surface is pressable".
 */
export function PressableCard({
  className,
  tone = 'plain',
  ...props
}: HTMLAttributes<HTMLButtonElement> & { onClick?: () => void; tone?: CardTone }) {
  return (
    <button
      type="button"
      className={clsx(
        'card-lift w-full rounded-3xl border p-5 text-left shadow-sm',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300',
        cardToneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
