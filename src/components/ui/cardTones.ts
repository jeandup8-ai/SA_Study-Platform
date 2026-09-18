import clsx from 'clsx'

/**
 * Tonal surfaces shared by `Card`, `PressableCard` and `linkCardClass`.
 *
 * These live here rather than in Card.tsx so that file exports components
 * only, and they are props/helpers rather than classes the caller passes:
 * this project uses `clsx` and not tailwind-merge, so a `bg-*` handed in
 * via className would collide with the surface below and which one wins is
 * not reliable.
 */
export type CardTone = 'plain' | 'brand' | 'volt' | 'gold' | 'ink'

export const cardToneClasses: Record<CardTone, string> = {
  plain: 'border-slate-200 bg-white',
  brand: 'border-brand-200 bg-brand-50',
  // volt-50 and brand-50 are near-identical to the eye, which made the two
  // tones indistinguishable side by side. volt steps up a shade so "volt"
  // reads as the accent it is.
  volt: 'border-volt-300 bg-volt-100',
  gold: 'border-gold-200 bg-gold-50',
  ink: 'border-ink-700 bg-ink-800 text-ink-50',
}

/**
 * The pressable card surface as a class string, for a card whose whole area
 * is a router `Link`. Wrapping a `PressableCard` in a `Link` would nest a
 * button inside an anchor, which is invalid HTML and breaks keyboard
 * activation; this gives the link the card's appearance directly instead.
 */
export function linkCardClass(opts: { tone?: CardTone; className?: string } = {}): string {
  const { tone = 'plain', className } = opts
  return clsx(
    'card-lift block rounded-3xl border p-5 shadow-sm',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300',
    cardToneClasses[tone],
    className,
  )
}
