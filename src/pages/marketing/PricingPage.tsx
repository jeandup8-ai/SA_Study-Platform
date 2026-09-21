import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BadgeCheck,
  ScanLine,
  Download,
  LineChart,
  Trophy,
  Languages,
  GraduationCap,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import {
  MarketingButton,
  PageHero,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/marketing'
import { formatRand } from '@/lib/billing/formatRand'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

const CHECKLIST_KEYS = [
  'curriculum',
  'aiExplain',
  'scan',
  'downloads',
  'progress',
  'gamification',
  'dailyGoals',
  'languages',
] as const
const CHECKLIST_ICONS = [
  GraduationCap,
  BadgeCheck,
  ScanLine,
  Download,
  LineChart,
  Trophy,
  Target,
  Languages,
]

const WHY_US_KEYS = [
  { key: 'specialist', icon: GraduationCap },
  { key: 'safety', icon: ShieldCheck },
] as const

export function PricingPage() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_cents')
      .then(({ data }) => setPlans(data ?? []))
  }, [])

  const monthlyPlan = plans.find((plan) => plan.billing_interval === 'monthly')
  const annualPlan = plans.find((plan) => plan.billing_interval === 'annual')
  const annualSavingsCents =
    monthlyPlan?.price_cents != null && annualPlan?.price_cents != null
      ? monthlyPlan.price_cents * 12 - annualPlan.price_cents
      : null

  return (
    <MarketingShell surface="dark">
      <PageHero
        eyebrow={t('m.nav.pricing')}
        title={t('pricing.title')}
        lead={t('pricing.subtitle')}
      />

      <Section tone="light">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {plans.map((plan, i) => {
            const isAnnual = plan.billing_interval === 'annual'
            const highlight =
              isAnnual && annualSavingsCents != null && annualSavingsCents > 0
            return (
              <Reveal key={plan.id} delay={i * 80}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl bg-white p-7 shadow-sm ${
                    highlight
                      ? 'ring-2 ring-volt-500 shadow-[0_20px_50px_-24px_var(--color-volt-500)]'
                      : 'border border-ink-200/70'
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-7 rounded-full bg-volt-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-ink-950">
                      {t('pricing.bestValue')}
                    </span>
                  )}
                  <p className="font-display text-lg font-extrabold text-ink-900">
                    {plan.name}
                  </p>
                  <p className="font-display mt-3 text-4xl font-extrabold tracking-tight text-ink-900">
                    {plan.price_cents != null
                      ? formatRand(plan.price_cents)
                      : t('common.priceTbc')}
                    <span className="text-base font-medium text-ink-400">
                      /{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </p>
                  <p className="mt-1.5 text-sm text-ink-500">
                    {t('parent.maxLearnersOnPlan', { count: plan.max_learners })}
                  </p>
                  {highlight && (
                    <p className="mt-1 text-sm font-semibold text-volt-700">
                      {t('pricing.annualSavings', {
                        amount: formatRand(annualSavingsCents!),
                      })}
                    </p>
                  )}
                  <MarketingButton
                    to="/sign-up"
                    variant={highlight ? 'volt' : 'light'}
                    size="md"
                    className="mt-6 w-full"
                  >
                    {t('pricing.getStarted')}
                  </MarketingButton>
                </div>
              </Reveal>
            )
          })}
          {plans.length === 0 && (
            <p className="col-span-2 text-center text-ink-400">
              {t('pricing.noPlansYet')}
            </p>
          )}
        </div>
      </Section>

      {plans.length > 0 && (
        <>
          <Section tone="white">
            <SectionHeading
              tone="light"
              align="center"
              title={t('pricing.includedTitle')}
            />
            <ul className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
              {CHECKLIST_KEYS.map((key, i) => {
                const Icon = CHECKLIST_ICONS[i]
                return (
                  <Reveal key={key} delay={Math.min(i, 8) * 45} as="li">
                    <span className="flex h-full items-start gap-3 rounded-2xl border border-ink-200/70 p-4">
                      <Icon
                        size={20}
                        className="mt-0.5 shrink-0 text-volt-600"
                        aria-hidden
                      />
                      <span className="text-sm text-ink-700">
                        {t(`pricing.checklist.${key}`)}
                      </span>
                    </span>
                  </Reveal>
                )
              })}
            </ul>
          </Section>

          <Section tone="dark">
            <SectionHeading align="center" title={t('pricing.whyUsTitle')} />
            <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-2">
              {WHY_US_KEYS.map(({ key, icon: Icon }, i) => (
                <Reveal key={key} delay={i * 80}>
                  <div className="h-full rounded-3xl border border-white/10 bg-white/5 p-6">
                    <Icon size={22} className="text-volt-300" aria-hidden />
                    <h3 className="font-display mt-4 text-lg font-extrabold text-white">
                      {t(`pricing.whyUs.${key}Title`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-200">
                      {t(`pricing.whyUs.${key}Body`)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Section>
        </>
      )}
    </MarketingShell>
  )
}
