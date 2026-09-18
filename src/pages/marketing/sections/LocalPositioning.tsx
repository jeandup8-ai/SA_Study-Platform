import { useTranslation } from 'react-i18next'
import { Banknote, Languages, Signal, BookMarked } from 'lucide-react'
import { Reveal, Section, SectionHeading } from '@/components/marketing'

/**
 * Built here, for here.
 *
 * The South African identity is carried by decisions rather than imagery --
 * CAPS as the curriculum spine, rand pricing through a local payment
 * provider, English and Afrikaans in the product with the remaining official
 * languages already in the data model, and a build that assumes a phone on
 * mobile data rather than a laptop on fibre. No flags, no wildlife.
 */
const PILLARS = [
  { key: 'caps', icon: BookMarked },
  { key: 'languages', icon: Languages },
  { key: 'rand', icon: Banknote },
  { key: 'data', icon: Signal },
] as const

export function LocalPositioning() {
  const { t } = useTranslation()

  return (
    <Section tone="dark">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-20">
        <SectionHeading
          eyebrow={t('m.local.eyebrow')}
          title={
            <>
              {t('m.local.titleLine1')}
              <br />
              <span className="bg-gradient-to-r from-volt-300 to-gold-300 bg-clip-text text-transparent">
                {t('m.local.titleLine2')}
              </span>
            </>
          }
          lead={t('m.local.lead')}
        />

        <ul className="grid gap-3 sm:grid-cols-2">
          {PILLARS.map(({ key, icon: Icon }, index) => (
            <Reveal as="li" key={key} delay={index * 80}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-300/15 text-gold-200">
                  <Icon size={18} />
                </span>
                <p className="mt-4 font-bold leading-snug text-white">
                  {t(`m.local.pillar.${key}.title`)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
                  {t(`m.local.pillar.${key}.body`)}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  )
}
