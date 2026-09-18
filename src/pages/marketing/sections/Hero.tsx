import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import {
  MarketingButton,
  PhoneFrame,
  Reveal,
  MasteryRing,
  SubjectRow,
  StreakPill,
  DailyGoalPill,
} from '@/components/marketing'

/**
 * Above the fold.
 *
 * The right-hand composition is a real StudyLegends learner dashboard --
 * greeting, daily goal, streak, the topic they are mid-way through, and
 * mastery per subject. The numbers belong to an illustrative sample learner;
 * they are not a claim about aggregate results.
 */
export function Hero() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden bg-ink-950">
      {/* Layered background: grid for the technology read, two radial glows
          for depth. All CSS -- no images to download on a mobile connection. */}
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="glow-volt absolute -left-32 -top-40 h-[34rem] w-[34rem] opacity-70" aria-hidden />
      <div
        className="glow-lilac absolute -bottom-52 right-[-10rem] h-[30rem] w-[30rem] opacity-50"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-volt-400/30 bg-volt-400/10 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-volt-200">
                <Sparkles size={13} />
                {t('m.hero.badge')}
              </span>
            </Reveal>

            <Reveal delay={70}>
              {/* The site's largest type. Two lines on purpose: the break is
                  where the promise turns. */}
              <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
                {t('m.hero.titleLine1')}
                <br />
                <span className="bg-gradient-to-r from-volt-300 via-volt-200 to-gold-300 bg-clip-text text-transparent">
                  {t('m.hero.titleLine2')}
                </span>
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200 sm:text-xl">
                {t('m.hero.lead')}
              </p>
            </Reveal>

            <Reveal delay={210}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <MarketingButton to="/sign-up" className="w-full sm:w-auto">
                  {t('m.cta.trial')}
                  <ArrowRight size={18} />
                </MarketingButton>
                <MarketingButton href="#how-it-works" variant="outline" className="w-full sm:w-auto">
                  {t('m.cta.howItWorks')}
                </MarketingButton>
              </div>
            </Reveal>

            <Reveal delay={280}>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
                {['caps', 'bilingual', 'noCard'].map((key) => (
                  <li key={key} className="flex items-center gap-2 text-sm font-semibold text-ink-300">
                    <Check size={15} className="shrink-0 text-volt-300" />
                    {t(`m.hero.assurance.${key}`)}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={160} className="relative mx-auto w-full max-w-[22rem] lg:max-w-none">
            <HeroDevice />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function HeroDevice() {
  const { t } = useTranslation()

  return (
    <div className="relative">
      <PhoneFrame>
        <div className="space-y-3 p-4 pt-7">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold text-ink-900">
                {t('m.device.greeting')}
              </p>
              <p className="truncate text-xs text-ink-400">{t('m.device.grade')}</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <StreakPill days={6} />
              <DailyGoalPill done={3} target={5} />
            </div>
          </div>

          {/* Continue learning -- the app's primary action for a returning learner. */}
          <div className="rounded-2xl bg-gradient-to-br from-ink-800 to-ink-900 p-3.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-volt-300">
              {t('m.device.continue')}
            </p>
            <p className="mt-1 text-sm font-bold text-white">{t('m.device.topic')}</p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="animate-bar-fill h-full w-[62%] rounded-full bg-volt-400" />
            </div>
          </div>

          {/* Guided help, as it appears in a lesson. */}
          <div className="flex items-start gap-2 rounded-2xl bg-white p-3 shadow-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-volt-500 text-white">
              <Sparkles size={12} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-ink-900">{t('m.device.tutorTitle')}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                {t('m.device.tutorLine')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <MasteryRing value={78} size={76} label={t('m.device.masteryLabel')} sublabel={t('m.device.masterySub')} />
          </div>

          <div className="space-y-2">
            <SubjectRow name={t('m.subject.mathematics')} mastery={78} />
            <SubjectRow name={t('m.subject.naturalSciences')} mastery={64} attention />
            <SubjectRow name={t('m.subject.englishHl')} mastery={82} />
          </div>
        </div>
      </PhoneFrame>

      {/* One floating fragment, and only where the viewport is wide enough for
          it to sit beside the device rather than on top of it. Below 2xl it is
          hidden: an overlay that covers the product it is advertising is worse
          than no overlay at all. */}
      <div
        className="animate-drift absolute -right-40 bottom-28 hidden w-40 rounded-2xl border border-white/10 bg-ink-900/95 p-3 shadow-2xl backdrop-blur 2xl:block"
        aria-hidden
      >
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-gold-300">
          {t('m.device.masteredLabel')}
        </p>
        <p className="mt-1.5 text-[11px] font-bold leading-snug text-white">
          {t('m.device.masteredTopic')}
        </p>
      </div>

    </div>
  )
}
