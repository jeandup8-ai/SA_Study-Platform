import { ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Section, SectionHeading } from './Section'
import { MarketingButton } from './MarketingButton'
import { Reveal } from './Reveal'

/**
 * The one conversion band shared by the free practice pages.
 *
 * The practice tests are the product's largest organic-search surface and
 * they are genuinely free and ungated. This band is the honest bridge from
 * them to the rest of StudyLegends: a test tells you where a child stands,
 * and the point being made is that knowing is not the same as being helped.
 *
 * What it claims is limited on purpose. Every line below is an existing
 * translated string describing a capability the product actually ships --
 * guided help, CAPS lessons, mastery per topic, exam readiness, homework
 * from a photo. There are no learner counts, no success rates, no
 * testimonials, no countdowns and no promise about marks, because none of
 * those would be true and a parent deciding whether to trust us with their
 * child will notice.
 *
 * On the test page itself there is deliberately no instance of this. That
 * page already converts at the strongest possible moment -- the end of a
 * completed test, offering to save the child's progress -- and a second
 * pitch underneath it would be the intrusive advertisement this is
 * supposed not to be.
 *
 * There is no click tracking on either button. This product has no
 * analytics of its own -- the Privacy Policy states that as a commitment
 * to parents -- so adding measurement here would have meant both a new
 * dependency and a contradiction of a live legal page. Conversion from
 * these pages is not currently measurable, and that is a deliberate
 * trade, not an oversight.
 */
export function PracticeUpsell({ tone = 'dark' }: { tone?: 'dark' | 'darker' }) {
  const { t } = useTranslation()

  const included = [
    t('m.pricing.included.tutor'),
    t('m.pricing.included.lessons'),
    t('m.pricing.included.practice'),
    t('m.pricing.included.progress'),
    t('m.pricing.included.exam'),
    t('m.pricing.included.scan'),
  ]

  return (
    <Section tone={tone}>
      {/* No eyebrow. The obvious one to reuse here is practice.freeBadge
          -- "Free · no sign-up" -- which is true of the tests and directly
          contradicts a band whose primary action is to sign up. */}
      <SectionHeading
        title={t('practice.understandTitle')}
        lead={t('practice.upsellBody')}
      />

      <Reveal delay={100}>
        <ul className="mt-9 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {included.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-ink-200">
              <Check size={16} className="mt-0.5 shrink-0 text-volt-300" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={160}>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Same destination and same words as the primary CTA everywhere
              else on the site, so the journey does not change its mind
              about what it is asking for. */}
          <MarketingButton to="/sign-up" variant="volt" className="w-full sm:w-auto">
            {t('m.cta.trial')}
            <ArrowRight size={18} aria-hidden />
          </MarketingButton>
          <MarketingButton to="/pricing" variant="outline" className="w-full sm:w-auto">
            {t('practice.upsellCta')}
          </MarketingButton>
        </div>
      </Reveal>
    </Section>
  )
}
