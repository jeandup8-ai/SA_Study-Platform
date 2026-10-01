import clsx from 'clsx'
import { subjectSkin } from '@/lib/subjects/subjectArt'

/**
 * A subject, shown as itself.
 *
 * Renders the subject's commissioned illustration when one exists and the
 * gradient-and-glyph tile when one does not. Both occupy the same square,
 * so a surface can adopt this now and gain artwork later without any
 * layout moving.
 *
 * Always decorative. Every place this appears, the subject's name is
 * already on screen next to it as real text, so the image carries
 * `alt=""` and the glyph is `aria-hidden` -- announcing "Mathematics"
 * twice helps nobody.
 */
export function SubjectMark({
  slug,
  size = 'md',
  className,
}: {
  slug: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const skin = subjectSkin(slug)

  const box = {
    sm: 'h-10 w-10 rounded-xl text-base',
    md: 'h-12 w-12 rounded-2xl text-xl',
    lg: 'h-16 w-16 rounded-2xl text-2xl',
  }[size]

  if (skin.art) {
    // The gradient stays behind the artwork rather than being replaced by
    // it. The Level B illustrations are specified with transparent
    // backgrounds precisely so the subject's colour continues to show
    // through -- the art and the colour system are one identity, not two
    // competing ones.
    return (
      <span
        className={clsx(
          'block shrink-0 overflow-hidden bg-gradient-to-br',
          box,
          skin.from,
          skin.to,
          className,
        )}
      >
        <img
          src={skin.art.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          style={{ objectPosition: skin.art.focal }}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center bg-gradient-to-br',
        'font-display font-extrabold text-ink-950',
        box,
        skin.from,
        skin.to,
        className,
      )}
    >
      {skin.glyph}
    </span>
  )
}
