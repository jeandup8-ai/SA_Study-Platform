import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { MarketingButton, Reveal, Section, SectionHeading } from '@/components/marketing'
import { supabase } from '@/lib/supabase'
import { formatRand } from '@/lib/billing/formatRand'
import {
  groupPlansByTier,
  planFor,
  hasInterval,
  type BillingInterval,
} from '@/lib/billing/planGroups'
import { BillingIntervalToggle } from '@/components/billing/BillingIntervalToggle'
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
  const [interval, setInterval] = useState<BillingInterval>('monthly')

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

  // Grouped, not `find`-ed. Taking the first monthly and the first annual
  // plan silently dropped the Family tier from this section the moment a
  // second tier existed -- the landing page advertised Solo only.
  const groups = groupPlansByTier(plans)
  const showToggle = hasInterval(groups, 'monthly') && hasInterval(groups, 'annual')
  const bestSavingCents = Math.max(0, ...groups.map((g) => g.annualSavingCents ?? 0))
  const visible = groups.filter((g) => planFor(g, interval) !== null)

  return (
    <Section tone="light" id="pricing">
      <SectionHeading
        eyebrow={t('m.pricing.eyebrow')}
        title={t('m.pricing.title')}
        lead={t('m.pricing.lead', { days: TRIAL_DAYS })}
        tone="light"
        align="center"
      />

      {showToggle && (
        <BillingIntervalToggle
          value={interval}
          onChange={setInterval}
          savingLabel={
            bestSavingCents > 0
              ? t('billing.saveUpTo', { amount: formatRand(bestSavingCents) })
              : undefined
          }
          className="mt-10"
        />
      )}

      <div className="mx-auto mt-8 grid max-w-3xl gap-5 sm:grid-cols-2">
        {loading &&
          Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-[1.75rem] border border-ink-200 bg-ink-100/60"
              aria-hidden
            />
          ))}
        {visible.map((group, index) => {
          const plan = planFor(group, interval)
          if (!plan) return null
          // The richer tier carries the emphasis now, not the annual card --
          // billing period is the toggle's job, so the cards are free to
          // compare tiers against each other.
          const isFeatured = index === visible.length - 1 && visible.length > 1
          const saving = interval === 'annual' ? group.annualSavingCents : null
          const showsSaving = saving != null && saving > 0
          return (
            <Reveal key={group.key} delay={index * 100}>
              <div
                className={clsx(
                  'relative flex h-full flex-col rounded-[1.75rem] p-7',
                  isFeatured
                    ? 'bg-ink-900 text-white ring-2 ring-volt-400'
                    : 'border border-ink-200 bg-white text-ink-900',
                )}
              >
                {showsSaving && (
                  <span className="absolute -top-3 left-7 rounded-full bg-volt-400 px-3 py-1 text-xs font-extrabold text-ink-950">
                    {t('m.pricing.bestValue')}
                  </span>
                )}

                <p
                  className={clsx(
                    'font-bold',
                    isFeatured ? 'text-volt-200' : 'text-ink-500',
                  )}
                >
                  {group.name}
                </p>

                <p className="mt-3 font-display text-5xl font-extrabold tracking-tight">
                  {plan.price_cents != null
                    ? formatRand(plan.price_cents)
                    : t('common.priceTbc')}
                  <span
                    className={clsx(
                      'ml-1 font-sans text-base font-semibold',
                      isFeatured ? 'text-ink-300' : 'text-ink-400',
                    )}
                  >
                    {interval === 'annual' ? t('billing.perYear') : t('billing.perMonth')}
                  </span>
                </p>

                {showsSaving ? (
                  <p className="mt-2 text-sm font-bold text-volt-300">
                    {t('m.pricing.saving', { amount: formatRand(saving) })}
                  </p>
                ) : (
                  <p
                    className={clsx(
                      'mt-2 text-sm',
                      isFeatured ? 'text-ink-300' : 'text-ink-400',
                    )}
                  >
                    {t('m.pricing.cancelAnytime')}
                  </p>
                )}

                <p
                  className={clsx(
                    'mt-4 text-sm',
                    isFeatured ? 'text-ink-300' : 'text-ink-500',
                  )}
                >
                  {t('m.pricing.learners', { count: plan.max_learners })}
                </p>

                <MarketingButton
                  to="/sign-up"
                  variant={isFeatured ? 'volt' : 'light'}
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
                <span className="text-sm text-ink-700">
                  {t(`m.pricing.included.${key}`)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-xs text-ink-400">
            {t('m.pricing.footnote')}
          </p>
        </Reveal>
      )}
    </Section>
  )
}
