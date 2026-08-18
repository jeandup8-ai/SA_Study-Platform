import { FractionsAnimation } from './FractionsAnimation'
import { PlaceValueAnimation } from './PlaceValueAnimation'
import { GenericConceptAnimation } from './GenericConceptAnimation'
import type { Media } from '@/types/curriculum'

/**
 * Renders lesson visual media. Internal `svg_animation` media picks one of our
 * hand-built React/SVG demo components via `media.source` (format: "key:args").
 * `youtube_embed` / `external_video` render inside a fixed, sandboxed iframe — the
 * URL always comes from a pre-approved `media` row, never a live search or user input.
 */
export function LessonVisual({ media, fallbackLabel }: { media: Media | null; fallbackLabel: string }) {
  if (!media) return <GenericConceptAnimation label={fallbackLabel} />

  if (media.media_type === 'svg_animation') {
    const [key, ...args] = (media.source ?? '').split(':')
    if (key === 'fractions') {
      const [numerator, denominator] = args.map(Number)
      return <FractionsAnimation numerator={numerator || 3} denominator={denominator || 4} />
    }
    if (key === 'place_value') {
      return <PlaceValueAnimation value={Number(args[0]) || 234} />
    }
    return <GenericConceptAnimation label={fallbackLabel} />
  }

  if ((media.media_type === 'youtube_embed' || media.media_type === 'external_video') && media.embed_url) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={media.embed_url}
          title={fallbackLabel}
          className="h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="encrypted-media"
          referrerPolicy="no-referrer"
        />
      </div>
    )
  }

  return <GenericConceptAnimation label={fallbackLabel} />
}
