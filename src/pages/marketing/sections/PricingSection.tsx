import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { MarketingButton, Reveal, Section, SectionHeading } from '@/components/marketing'
import { supabase } from '@/lib/supabase'
import { TRIAL_DAYS } from '@/lib/billing/trial'
import { withTimeout } from '@/lib/marketing/withTimeout'
import type { Database } from '@/types/database'

type Plan = Database['public']['Tables']['subscription_plans']['Row']

/**
 * Pricing, read from the database rather than written into the page.
 *
 * The prices here have to be the prices PayFast will actually charge. Typing
 * them into markup means the site and the checkout can disagree after any
 * plan change, which is the one mistake on this page that costs real money
 * and real trust. Reading `subscription_plans` makes that impossible.
 */
const INCLUDED = [
  'curriculum',
  'lessons',
  'tutor',
  'scan',
  'practice',
  'exam',
  'progress',
  'languages',
  'learners',
  'offline',
] as const

export function PricingSection() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Same reason as the subjects section: a network failure rejects, and
    // without handling it the pricing block would sit on skeletons
    // indefinitely instead of falling back to a working call to action.
    // The Supabase builder is only PromiseLike, so it is awaited rather than
    // chained with .catch().
    let cancelled = false
    async function load() {
      const plans = await withTimeout(
        (async () => {
          const { data } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price_cents')
          return data ?? []
        })(),
        [] as Plan[],
      )
      if (cancelled) return
      setPlans(plans)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const monthly = plans.find((plan) => plan.billing_interval === 'monthly')
  const annual = plans.find((plan) => plan.billing_interval === 'annual')
  const annualSavingCents =
    monthly?.price_cents != null && annual?.price_cents != null
      ? monthly.price_cents * 12 - annual.price_cents
      : null

  return (
    <Section tone="light" id="pricing">
      <SectionHeading
        eyebrow={t('m.pricing.eyebrow')}
        title={t('m.pricing.title')}
        lead={t('m.pricing.lead', { days: TRIAL_DAYS })}
        tone="light"
        align="center"
      />

      <div className="mx-auto mt-14 grid max-w-3xl gap-5 sm:grid-cols-2">
        {loading &&
          Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-[1.75rem] border border-ink-200 bg-ink-100/60"
              aria-hidden
            />
          ))}
        {[monthly, annual].map((plan, index) => {
          if (!plan) return null
          const isAnnual = plan.billing_interval === 'annual'
          const showsSaving = isAnnual && annualSavingCents != null && annualSavingCents > 0
          return (
            <Reveal key={plan.id} delay={index * 100}>
              <div
                className={clsx(
                  'relative flex h-full flex-col rounded-[1.75rem] p-7',
                  isAnnual
                    ? 'bg-ink-900 text-white ring-2 ring-volt-400'
                    : 'border border-ink-200 bg-white text-ink-900',
                )}
              >
                {showsSaving && (
                  <span className="absolute -top-3 left-7 rounded-full bg-volt-400 px-3 py-1 text-xs font-extrabold text-ink-950">
                    {t('m.pricing.bestValue')}
                  </span>
                )}

                <p className={clsx('font-bold', isAnnual ? 'text-volt-200' : 'text-ink-500')}>
                  {t(isAnnual ? 'm.pricing.annualName' : 'm.pricing.monthlyName')}
                </p>

                <p className="mt-3 font-display text-5xl font-extrabold tracking-tight">
                  {plan.price_cents != null ? `R${(plan.price_cents / 100).toFixed(0)}` : t('common.priceTbc')}
                  <span
                    className={clsx(
                      'ml-1 font-sans text-base font-semibold',
                      isAnnual ? 'text-ink-300' : 'text-ink-400',
                    )}
                  >
                    {t(isAnnual ? 'm.pricing.perYear' : 'm.pricing.perMonth')}
                  </span>
                </p>

                {showsSaving ? (
                  <p className="mt-2 text-sm font-bold text-volt-300">
                    {t('m.pricing.saving', { amount: (annualSavingCents / 100).toFixed(0) })}
                  </p>
                ) : (
                  <p className={clsx('mt-2 text-sm', isAnnual ? 'text-ink-300' : 'text-ink-400')}>
                    {t('m.pricing.cancelAnytime')}
                  </p>
                )}

                <p className={clsx('mt-4 text-sm', isAnnual ? 'text-ink-300' : 'text-ink-500')}>
                  {t('m.pricing.learners', { count: plan.max_learners })}
                </p>

                <MarketingButton
                  to="/sign-up"
                  variant={isAnnual ? 'volt' : 'light'}
                  className="mt-7 w-full"
                >
                  {t('m.cta.trial')}
                </MarketingButton>
              </div>
            </Reveal>
          )
        })}

        {/* Never strand the visitor on an empty pricing block: if plans cannot
            be read, keep the trial reachable and send them to the full page. */}
        {!loading && plans.length === 0 && (
          <div className="col-span-full rounded-[1.75rem] border border-ink-200 bg-white p-8 text-center">
            <p className="text-ink-500">{t('m.pricing.unavailable')}</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <MarketingButton to="/sign-up" size="md">
                {t('m.cta.trial')}
              </MarketingButton>
              <MarketingButton to="/pricing" variant="light" size="md">
                {t('m.pricing.seeFullPricing')}
              </MarketingButton>
            </div>
          </div>
        )}
      </div>

      {!loading && plans.length > 0 && (
        <Reveal delay={200} className="mx-auto mt-14 max-w-3xl">
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.14em] text-ink-400">
            {t('m.pricing.includedTitle')}
          </p>
          <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {INCLUDED.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Check size={17} className="mt-0.5 shrink-0 text-volt-600" />
                <span className="text-sm text-ink-700">{t(`m.pricing.included.${key}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-xs text-ink-400">{t('m.pricing.footnote')}</p>
        </Reveal>
      )}
    </Section>
  )
}
