import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EyeOff, MessageSquareOff, UserLock, VideoIcon, KeyRound, FileText } from 'lucide-react'
import { Reveal, Section, SectionHeading } from '@/components/marketing'

/**
 * Safety, stated as facts about how the product is built.
 *
 * Every claim here is a design decision that can be checked in the app: there
 * is no learner-to-learner messaging, no public profile, no social feed, every
 * suggested video is reviewed by a person before a learner can see it, and
 * accounts are created and held by a parent.
 *
 * What this section deliberately does NOT do is claim POPIA compliance or any
 * certification. Neither has been independently established, and asserting it
 * would be a false statement on a live page.
 */
const PRINCIPLES = [
  { key: 'noMessaging', icon: MessageSquareOff },
  { key: 'noProfiles', icon: EyeOff },
  { key: 'parentHeld', icon: UserLock },
  { key: 'reviewedVideo', icon: VideoIcon },
  { key: 'noAds', icon: KeyRound },
  { key: 'plainTerms', icon: FileText },
] as const

export function Safety() {
  const { t } = useTranslation()

  return (
    <Section tone="darker">
      <SectionHeading
        eyebrow={t('m.safety.eyebrow')}
        title={
          <>
            {t('m.safety.titleLine1')}
            <br />
            <span className="text-volt-300">{t('m.safety.titleLine2')}</span>
          </>
        }
        lead={t('m.safety.lead')}
        align="center"
      />

      <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map(({ key, icon: Icon }, index) => (
          <Reveal as="li" key={key} delay={index * 60}>
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-volt-400/12 text-volt-200">
                <Icon size={18} />
              </span>
              <p className="mt-4 font-bold leading-snug text-white">
                {t(`m.safety.principle.${key}.title`)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-300">
                {t(`m.safety.principle.${key}.body`)}
              </p>
            </div>
          </Reveal>
        ))}
      </ul>

      <Reveal delay={400} className="mt-10">
        <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-ink-400">
          {t('m.safety.note')}{' '}
          <Link to="/privacy" className="font-bold text-volt-300 underline">
            {t('m.safety.privacyLink')}
          </Link>
          .
        </p>
      </Reveal>
    </Section>
  )
}
