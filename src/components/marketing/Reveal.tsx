import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Reveals its children once they scroll into view.
 *
 * The element starts at `opacity: 0` via the `.reveal` class and animates in
 * once. Two things matter here:
 *
 * - The content is always in the DOM, so a crawler and a screen reader see it
 *   regardless of whether the animation ever runs.
 * - `prefers-reduced-motion` is handled in CSS rather than here, which means a
 *   reader with motion turned off sees the content at full opacity
 *   immediately instead of a blank section.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  /** Stagger, in milliseconds. Keep under ~400ms; longer reads as a bug. */
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'section'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    // Older Safari on iOS is the main mobile target here; guard anyway.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      // Fire slightly before the element is fully on screen so the animation
      // is already finishing by the time the reader reaches it.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={clsx('reveal', shown && 'reveal-in', className)}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
