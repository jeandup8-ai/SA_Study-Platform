import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { HelpCircle, Lightbulb, PenLine, Trophy } from 'lucide-react'
import { Reveal, Section, SectionHeading } from '@/components/marketing'

/**
 * The problem, then the shape of the fix.
 *
 * A learner who is stuck usually does not need the answer -- they need the
 * step they missed. This section states that, then shows the four states a
 * learner actually moves through. The stages animate in sequence so the chain
 * reads as a progression rather than as four unrelated boxes.
 */
const STAGES = [
  { key: 'confused', icon: HelpCircle, tone: 'muted' },
  { key: 'explained', icon: Lightbulb, tone: 'volt' },
  { key: 'practised', icon: PenLine, tone: 'volt' },
  { key: 'mastered', icon: Trophy, tone: 'gold' },
] as const

export function MakeSense() {
  const { t } = useTranslation()

  return (
    <Section tone="darker">
      <SectionHeading
        eyebrow={t('m.makeSense.eyebrow')}
        title={t('m.makeSense.title')}
        lead={t('m.makeSense.lead')}
        align="center"
      />

      <ol className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        {STAGES.map(({ key, icon: Icon, tone }, index) => (
          <Reveal as="li" key={key} delay={index * 120} className="relative">
            {/* Connector. Drawn only between cards, and only where the layout
                actually places them side by side. */}
            {index < STAGES.length - 1 && (
              <span
                className="absolute right-[-0.5rem] top-14 hidden h-px w-4 bg-gradient-to-r from-volt-400/70 to-transparent lg:block"
                aria-hidden
              />
            )}
            <div
              className={clsx(
                'h-full rounded-3xl border p-6 transition-colors duration-300',
                tone === 'muted' && 'border-white/10 bg-white/[0.03]',
                tone === 'volt' && 'border-volt-400/25 bg-volt-400/[0.07]',
                tone === 'gold' && 'border-gold-300/30 bg-gold-300/[0.08]',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'flex h-11 w-11 items-center justify-center rounded-2xl',
                    tone === 'muted' && 'bg-white/10 text-ink-300',
                    tone === 'volt' && 'bg-volt-400/20 text-volt-200',
                    tone === 'gold' && 'bg-gold-300/20 text-gold-200',
                  )}
                >
                  <Icon size={21} />
                </span>
                <span className="font-display text-sm font-extrabold text-ink-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <p
                className={clsx(
                  'mt-5 font-display text-xl font-extrabold uppercase tracking-tight',
                  tone === 'muted' ? 'text-ink-300' : 'text-white',
                )}
              >
                {t(`m.makeSense.stage.${key}.label`)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                {t(`m.makeSense.stage.${key}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={480} className="mt-12">
        <p className="mx-auto max-w-2xl text-center text-base font-semibold text-ink-200 sm:text-lg">
          {t('m.makeSense.closing')}
        </p>
      </Reveal>
    </Section>
  )
}
