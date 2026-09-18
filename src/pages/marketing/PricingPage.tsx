import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { Button, Card } from '@/components/ui'
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
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-center font-display text-3xl font-extrabold tracking-tight text-slate-900">
          {t('pricing.title')}
        </h1>
        <p className="mt-2 text-center text-slate-500">{t('pricing.subtitle')}</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => {
            const isAnnual = plan.billing_interval === 'annual'
            return (
              <Card
                key={plan.id}
                className={isAnnual ? 'relative ring-2 ring-brand-500' : 'relative'}
              >
                {isAnnual && annualSavingsCents != null && annualSavingsCents > 0 && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                    {t('pricing.bestValue')}
                  </span>
                )}
                <p className="font-bold text-slate-900">{plan.name}</p>
                <p className="mt-2 text-3xl font-extrabold text-brand-700">
                  {plan.price_cents != null
                    ? formatRand(plan.price_cents)
                    : t('common.priceTbc')}
                  <span className="text-base font-medium text-slate-500">
                    /{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t('parent.maxLearnersOnPlan', { count: plan.max_learners })}
                </p>
                {isAnnual && annualSavingsCents != null && annualSavingsCents > 0 && (
                  <p className="mt-1 text-sm font-semibold text-brand-600">
                    {t('pricing.annualSavings', {
                      amount: formatRand(annualSavingsCents),
                    })}
                  </p>
                )}
                <Link to="/sign-up" className="mt-4 block">
                  <Button className="w-full">{t('pricing.getStarted')}</Button>
                </Link>
              </Card>
            )
          })}
          {plans.length === 0 && (
            <p className="col-span-2 text-center text-slate-400">
              {t('pricing.noPlansYet')}
            </p>
          )}
        </div>

        {plans.length > 0 && (
          <>
            <div className="mt-16">
              <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-900">
                {t('pricing.includedTitle')}
              </h2>
              <ul className="mx-auto mt-6 grid max-w-2xl gap-4 sm:grid-cols-2">
                {CHECKLIST_KEYS.map((key, i) => {
                  const Icon = CHECKLIST_ICONS[i]
                  return (
                    <li
                      key={key}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"
                    >
                      <Icon size={20} className="mt-0.5 shrink-0 text-brand-600" />
                      <span className="text-sm text-slate-700">
                        {t(`pricing.checklist.${key}`)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-16">
              <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-900">
                {t('pricing.whyUsTitle')}
              </h2>
              <div className="mx-auto mt-6 grid max-w-2xl gap-6 sm:grid-cols-2">
                {WHY_US_KEYS.map(({ key, icon: Icon }) => (
                  <div key={key} className="rounded-3xl bg-brand-50 p-6">
                    <Icon size={22} className="text-brand-600" />
                    <h3 className="mt-3 font-bold text-slate-900">
                      {t(`pricing.whyUs.${key}Title`)}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {t(`pricing.whyUs.${key}Body`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </MarketingShell>
  )
}
