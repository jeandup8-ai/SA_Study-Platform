/**
 * One visual identity per subject, for every surface that shows a subject.
 *
 * Two problems this solves.
 *
 * The first is that the identity existed in exactly one place -- a private
 * `SKINS` map inside the marketing Subjects section -- so Mathematics was
 * a volt gradient with a division sign on the public site and nothing at
 * all inside the app, where a learner picks a subject every single day.
 * Keyed by slug, in one module, both surfaces now read the same source.
 *
 * The second is Level B artwork. Each subject will eventually carry a
 * commissioned illustration (see IMAGE_GENERATION_MANIFEST.md). None has
 * been generated or reviewed yet, so every `art` below is null, and that
 * is the point of the shape: a subject with no artwork renders the
 * gradient and glyph it renders today. A missing image is the current
 * good experience, not a broken card. Artwork arrives one subject at a
 * time, by filling in one `art` field, and nothing else has to change.
 *
 * Slugs are the real ones from `subjects.slug`. All ten are listed,
 * including the three that carry no topics yet -- Economic and Management
 * Sciences, Life Orientation and Technology -- so that when curriculum is
 * added for them they do not appear as an anonymous grey fallback.
 */

export interface SubjectArtwork {
  /** Path under /public, e.g. "/subject-art/mathematics.webp". */
  src: string
  /**
   * Where the subject matter sits in the frame, as a CSS object-position.
   * Square crops on a card cannot always be centred -- a composition that
   * reads well as a wide hero often has its focal point above centre.
   */
  focal: string
}

export interface SubjectSkin {
  /** Tailwind gradient stops for the fallback tile and the card's wash. */
  from: string
  to: string
  /** Single character shown on the fallback tile. Never read aloud. */
  glyph: string
  /** Commissioned illustration, or null until one is reviewed and added. */
  art: SubjectArtwork | null
}

export const SUBJECT_SKINS: Record<string, SubjectSkin> = {
  mathematics: { from: 'from-volt-400', to: 'to-volt-600', glyph: '÷', art: null },
  'natural-sciences': {
    from: 'from-lilac-400',
    to: 'to-lilac-600',
    glyph: '⚗',
    art: null,
  },
  'social-sciences': { from: 'from-gold-300', to: 'to-gold-500', glyph: '⊕', art: null },
  'english-home-language': {
    from: 'from-volt-300',
    to: 'to-lilac-500',
    glyph: 'Aa',
    art: null,
  },
  'afrikaans-first-additional-language': {
    from: 'from-lilac-300',
    to: 'to-volt-500',
    glyph: 'Aa',
    art: null,
  },
  'life-skills': { from: 'from-gold-200', to: 'to-coral-400', glyph: '♡', art: null },
  'creative-arts': { from: 'from-coral-300', to: 'to-lilac-500', glyph: '♫', art: null },

  // No topics yet. Listed so they inherit a deliberate identity the day
  // curriculum lands rather than falling through to the grey default.
  'economic-and-management-sciences': {
    from: 'from-gold-400',
    to: 'to-coral-400',
    glyph: 'R',
    art: null,
  },
  'life-orientation': {
    from: 'from-coral-300',
    to: 'to-gold-400',
    glyph: '◎',
    art: null,
  },
  technology: { from: 'from-volt-500', to: 'to-ink-500', glyph: '⚙', art: null },
}

export const FALLBACK_SUBJECT_SKIN: SubjectSkin = {
  from: 'from-ink-400',
  to: 'to-ink-600',
  glyph: '•',
  art: null,
}

export function subjectSkin(slug: string | null | undefined): SubjectSkin {
  if (!slug) return FALLBACK_SUBJECT_SKIN
  return SUBJECT_SKINS[slug] ?? FALLBACK_SUBJECT_SKIN
}
