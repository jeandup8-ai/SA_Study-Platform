import { useState } from 'react'
import clsx from 'clsx'
import { subjectSkin } from '@/lib/subjects/subjectArt'

/**
 * A subject, shown as itself.
 *
 * Renders the subject's approved illustration when one exists and the
 * gradient-and-glyph tile when one does not. Both occupy the same square,
 * so a surface can adopt this now and gain artwork later without any
 * layout moving.
 *
 * There are three states, not two, and the third is the one that matters:
 *
 *   - no artwork declared  -> gradient and glyph
 *   - artwork declared and it loads -> the illustration over its gradient
 *   - artwork declared and it fails -> gradient and glyph again
 *
 * The third covers a path typed wrongly, a file not deployed, a cache
 * miss on a flaky mobile connection. Without it a single bad path shows a
 * broken-image icon on every subject card in the product. With it, the
 * worst case is the design we already ship.
 *
 * Always decorative by default. Every place this appears today, the
 * subject's name is already on screen beside it as real text, so the
 * image carries `alt=""` and the glyph is `aria-hidden` -- announcing
 * "Mathematics" twice helps nobody. A surface that shows the mark without
 * an adjacent name passes `label` and gets real alternative text instead.
 */
export function SubjectMark({
  slug,
  size = 'md',
  label,
  className,
}: {
  slug: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  /**
   * Alternative text, for the rare surface where this mark is the only
   * thing identifying the subject. Omit wherever the name is adjacent.
   */
  label?: string
  className?: string
}) {
  const skin = subjectSkin(slug)
  const [failed, setFailed] = useState(false)

  const box = {
    sm: 'h-10 w-10 rounded-xl text-base',
    md: 'h-12 w-12 rounded-2xl text-xl',
    lg: 'h-16 w-16 rounded-2xl text-2xl',
  }[size]

  // The gradient is the backdrop in both states, not a replacement for the
  // artwork. Level B illustrations are specified with transparent
  // backgrounds precisely so the subject's colour continues to show
  // through: the art and the colour system are one identity, not two
  // competing ones. Keeping it painted also means a slow image fades in
  // over the right colour rather than over a hole.
  const surface = clsx(
    'shrink-0 overflow-hidden bg-gradient-to-br',
    box,
    skin.from,
    skin.to,
    className,
  )

  if (skin.art && !failed) {
    return (
      <span className={clsx('block', surface)}>
        <img
          src={skin.art.src}
          alt={label ?? ''}
          loading="lazy"
          decoding="async"
          // contain, never cover: these are centred compositions with
          // deliberate margin, and cropping one would cut the subject out
          // of its own illustration.
          className="h-full w-full object-contain"
          style={{ objectPosition: skin.art.focal }}
          onError={() => setFailed(true)}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      className={clsx(
        'flex items-center justify-center font-display font-extrabold text-ink-950',
        surface,
      )}
    >
      {skin.glyph}
    </span>
  )
}
