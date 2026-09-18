import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { MarketingButton, Reveal } from '@/components/marketing'
import { TRIAL_DAYS } from '@/lib/billing/trial'

/** The closing frame: one headline, one promise, one action. */
export function FinalCta() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden />
      <div
        className="glow-volt absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 opacity-70"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 py-28 text-center sm:px-6 sm:py-36">
        <Reveal>
          <h2 className="font-display text-[2.75rem] font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
            {t('m.final.titleLine1')}
            <br />
            <span className="bg-gradient-to-r from-volt-300 via-volt-200 to-gold-300 bg-clip-text text-transparent">
              {t('m.final.titleLine2')}
            </span>
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <p className="mx-auto mt-6 max-w-xl text-lg text-ink-200 sm:text-xl">{t('m.final.lead')}</p>
        </Reveal>

        <Reveal delay={180}>
          <div className="mt-10 flex flex-col items-center gap-4">
            <MarketingButton to="/sign-up" className="w-full sm:w-auto">
              {t('m.final.cta', { days: TRIAL_DAYS })}
              <ArrowRight size={18} />
            </MarketingButton>
            <p className="text-sm text-ink-400">{t('m.final.reassurance')}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
