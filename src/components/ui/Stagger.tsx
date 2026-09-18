import type { CSSProperties, ReactNode } from 'react'
import clsx from 'clsx'

const STEP_MS = 55
/** Past about ten items the delay stops reading as rhythm and starts
 * reading as lag, so it is capped rather than growing with the list. */
const MAX_STEPS = 10

/**
 * Gives a list item a small entrance delay based on its index, so a list
 * arrives as a cascade instead of a block. The animation only affects
 * opacity and translation; the element is in the DOM and in the
 * accessibility tree from the first frame, and the reduced-motion block in
 * index.css removes the animation entirely.
 */
export function Stagger({
  index,
  children,
  className,
  as: Tag = 'div',
}: {
  index: number
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const style = { '--stagger': `${Math.min(index, MAX_STEPS) * STEP_MS}ms` } as CSSProperties
  return (
    <Tag className={clsx('stagger-in', className)} style={style}>
      {children}
    </Tag>
  )
}
