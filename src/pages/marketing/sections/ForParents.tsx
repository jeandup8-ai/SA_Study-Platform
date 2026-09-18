import { useTranslation } from 'react-i18next'
import { CalendarDays, Gauge, Mail, Users, SlidersHorizontal, Compass } from 'lucide-react'
import { MarketingButton, Reveal, Section, SectionHeading } from '@/components/marketing'

/**
 * The parent case.
 *
 * No illustrations, no characters, no colour play -- this section is set like
 * a business page on purpose, because the person reading it is deciding
 * whether to trust us with their child and their card. Every item below maps
 * to a feature that exists: the parent dashboard, the weekly email digest,
 * the starting-point assessment, multi-learner profiles, and subscription
 * control.
 */
const CAPABILITIES = [
  { key: 'dashboard', icon: Gauge },
  { key: 'attention', icon: Compass },
  { key: 'digest', icon: Mail },
  { key: 'startingPoint', icon: CalendarDays },
  { key: 'learners', icon: Users },
  { key: 'control', icon: SlidersHorizontal },
] as const

export function ForParents() {
  const { t } = useTranslation()

  return (
    <Section tone="white" id="for-parents">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <SectionHeading
            eyebrow={t('m.parents.eyebrow')}
            title={
              <>
                {t('m.parents.titleLine1')}
                <br />
                <span className="text-ink-400">{t('m.parents.titleLine2')}</span>
              </>
            }
            lead={t('m.parents.lead')}
            tone="light"
          />

          <Reveal delay={180} className="mt-9">
            <MarketingButton to="/sign-up" variant="light">
              {t('m.cta.trial')}
            </MarketingButton>
          </Reveal>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {CAPABILITIES.map(({ key, icon: Icon }, index) => (
            <Reveal as="li" key={key} delay={index * 70}>
              <div className="h-full rounded-2xl border border-ink-100 bg-ink-50/50 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink-700 shadow-sm">
                  <Icon size={18} />
                </span>
                <p className="mt-4 font-bold leading-snug text-ink-900">
                  {t(`m.parents.capability.${key}.title`)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
                  {t(`m.parents.capability.${key}.body`)}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}
