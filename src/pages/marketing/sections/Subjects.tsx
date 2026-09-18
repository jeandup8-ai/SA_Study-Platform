import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { ArrowUpRight } from 'lucide-react'
import { MarketingButton, Reveal, Section, SectionHeading } from '@/components/marketing'
import { localizedName } from '@/lib/i18n/localizedName'
import { withTimeout } from '@/lib/marketing/withTimeout'
import {
  fetchMarketingSubjects,
  formatGradeRange,
  type MarketingSubject,
} from '@/lib/marketing/subjects'
import type { LanguageCode } from '@/types/curriculum'

/**
 * Subject cards, built from the live curriculum.
 *
 * Each card carries its own colour identity so the grid reads as a set of
 * places to go rather than a table of contents. The three-verb line under
 * each name is the promise for that subject; the grade range and topic count
 * come straight from the database, so neither can overstate what we cover.
 */

/** Visual identity per subject. Keyed by slug; unknown slugs fall back. */
const SKINS: Record<string, { from: string; to: string; glyph: string }> = {
  mathematics: { from: 'from-volt-400', to: 'to-volt-600', glyph: '÷' },
  'natural-sciences': { from: 'from-lilac-400', to: 'to-lilac-600', glyph: '⚗' },
  'social-sciences': { from: 'from-gold-300', to: 'to-gold-500', glyph: '⊕' },
  'english-home-language': { from: 'from-volt-300', to: 'to-lilac-500', glyph: 'Aa' },
  'afrikaans-first-additional-language': { from: 'from-lilac-300', to: 'to-volt-500', glyph: 'Aa' },
  'life-skills': { from: 'from-gold-200', to: 'to-coral-400', glyph: '♡' },
  'creative-arts': { from: 'from-coral-300', to: 'to-lilac-500', glyph: '♫' },
}

const FALLBACK_SKIN = { from: 'from-ink-400', to: 'to-ink-600', glyph: '•' }

export function Subjects() {
  const { t, i18n } = useTranslation()
  const language = (i18n.language.startsWith('af') ? 'af' : 'en') as LanguageCode
  const [subjects, setSubjects] = useState<MarketingSubject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Bounded: a request that rejects OR stalls must still end in a rendered
    // state, otherwise the section is stuck on skeletons indefinitely.
    let cancelled = false
    void withTimeout(fetchMarketingSubjects(), []).then((rows) => {
      if (cancelled) return
      setSubjects(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Section tone="dark" id="subjects">
      <SectionHeading
        eyebrow={t('m.subjects.eyebrow')}
        title={t('m.subjects.title')}
        lead={t('m.subjects.lead')}
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Placeholders while the curriculum loads. Without these the section
            is a heading above empty space for the length of the request,
            which on a marketing page reads as a broken build. */}
        {loading &&
          Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[0.035]"
              aria-hidden
            />
          ))}
        {subjects.map((subject, index) => {
          const skin = SKINS[subject.slug] ?? FALLBACK_SKIN
          const range = formatGradeRange(subject.grades)
          return (
            <Reveal key={subject.slug} delay={index * 70}>
              <a
                href="#pricing"
                className={clsx(
                  'group relative flex h-full flex-col overflow-hidden rounded-[1.75rem]',
                  'border border-white/10 bg-white/[0.035] p-6 transition-all duration-300',
                  'hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300/50',
                )}
              >
                {/* Colour wash that lifts on hover -- the "portal" read. */}
                <span
                  className={clsx(
                    'pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40',
                    skin.from,
                    skin.to,
                  )}
                  aria-hidden
                />

                <div className="flex items-start justify-between gap-3">
                  <span
                    className={clsx(
                      'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br font-display text-xl font-extrabold text-ink-950',
                      skin.from,
                      skin.to,
                    )}
                    aria-hidden
                  >
                    {skin.glyph}
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="mt-1 text-ink-500 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </div>

                <h3 className="mt-5 font-display text-xl font-extrabold leading-tight tracking-tight text-white">
                  {localizedName({ name: subject.name, name_af: subject.nameAf }, language)}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-volt-200">
                  {t(`m.subjects.promise.${subject.slug}`, { defaultValue: t('m.subjects.promiseDefault') })}
                </p>

                <p className="mt-auto pt-6 text-xs font-semibold text-ink-400">
                  {t(range.key, { value: range.value })} &middot;{' '}
                  {t('m.subjects.topicCount', { count: subject.topicCount })}
                </p>
              </a>
            </Reveal>
          )
        })}
      </div>

      {!loading && subjects.length > 0 && (
        <Reveal delay={200}>
          <p className="mt-8 text-sm text-ink-400">{t('m.subjects.footnote')}</p>
        </Reveal>
      )}

      {/* If the curriculum cannot be reached, say something true and keep the
          next step available rather than showing an empty grid. */}
      {!loading && subjects.length === 0 && (
        <Reveal>
          <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-8 text-center">
            <p className="text-ink-200">{t('m.subjects.unavailable')}</p>
            <MarketingButton to="/practice" variant="outline" size="md" className="mt-5">
              {t('m.subjects.browseFree')}
            </MarketingButton>
          </div>
        </Reveal>
      )}
    </Section>
  )
}
