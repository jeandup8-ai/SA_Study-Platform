import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatRand } from '@/lib/billing/formatRand'
import {
  groupPlansByTier,
  planFor,
  hasInterval,
  type BillingInterval,
} from '@/lib/billing/planGroups'
import { BillingIntervalToggle } from '@/components/billing/BillingIntervalToggle'
import { Badge, Button, Card, PageHeader, Skeleton } from '@/components/ui'
import type { Subscription } from '@/types/curriculum'
import type { Database } from '@/types/database'
import { TRIAL_DAYS } from '@/lib/billing/trial'

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

function submitToPayFast(action: string, fields: Record<string, string>) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

export function SubscriptionPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const [searchParams] = useSearchParams()
  const paymentResult = searchParams.get('payment')
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [startingTrial, setStartingTrial] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  function loadSubscription() {
    if (!parent) return
    supabase
      .from('subscriptions')
      .select('*')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSubscription(data))
  }

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_cents')
      .then(({ data }) => setPlans(data ?? []))
    loadSubscription()
  }, [parent])

  async function startTrial(planId: string) {
    if (!parent) return
    setStartingTrial(planId)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
    const { data } = await supabase
      .from('subscriptions')
      .insert({
        parent_id: parent.id,
        plan_id: planId,
        status: 'trialing',
        trial_ends_at: trialEnd.toISOString(),
      })
      .select('*')
      .single()
    setSubscription(data ?? null)
    setStartingTrial(null)
  }

  async function checkout(planId: string) {
    setCheckingOut(planId)
    setCheckoutError(null)
    const { data, error } = await supabase.functions.invoke('payfast-checkout', {
      body: { planId },
    })
    setCheckingOut(null)
    if (error || !data?.action || !data?.fields) {
      setCheckoutError(
        data?.error === 'feature_not_configured'
          ? t('parent.checkoutFeatureUnavailable')
          : t('parent.checkoutFailed'),
      )
      return
    }
    submitToPayFast(data.action, data.fields)
  }

  async function cancelSubscription() {
    setCanceling(true)
    await supabase.functions.invoke('payfast-cancel', { body: {} })
    setCanceling(false)
    loadSubscription()
  }

  const isPayingStatus =
    subscription && ['active', 'past_due', 'incomplete'].includes(subscription.status)

  return (
    <div>
      <PageHeader title={t('parent.manageSubscription')} />

      {paymentResult === 'success' && (
        <Card className="mt-4 bg-success-50">
          <p className="text-sm text-success-600">{t('parent.paymentConfirming')}</p>
        </Card>
      )}
      {paymentResult === 'cancelled' && (
        <Card className="mt-4 bg-warning-50">
          <p className="text-sm text-warning-600">{t('parent.checkoutCancelled')}</p>
        </Card>
      )}

      {subscription && (
        <Card className="mt-4 bg-brand-50">
          <Badge
            tone={
              subscription.status === 'active'
                ? 'success'
                : subscription.status === 'trialing'
                  ? 'sun'
                  : 'warning'
            }
          >
            {t(`parent.subscriptionStatus.${subscription.status}`)}
          </Badge>
          {subscription.trial_ends_at && subscription.status === 'trialing' && (
            <p className="mt-2 text-sm text-brand-800">
              {t('parent.trialEndsOn', {
                date: new Date(subscription.trial_ends_at).toLocaleDateString(),
              })}
            </p>
          )}
          {subscription.current_period_end && subscription.status === 'active' && (
            <p className="mt-2 text-sm text-brand-800">
              {t('parent.nextBillingDate', {
                date: new Date(subscription.current_period_end).toLocaleDateString(),
              })}
            </p>
          )}
          {subscription.cancel_requested_at && (
            <p className="mt-2 text-sm text-brand-800">
              {t('parent.cancellationRequestedNote')}
            </p>
          )}
          {isPayingStatus && !subscription.cancel_requested_at && (
            <Button
              className="mt-3"
              variant="secondary"
              disabled={canceling}
              onClick={cancelSubscription}
            >
              {canceling ? t('common.loading') : t('parent.cancelSubscription')}
            </Button>
          )}
        </Card>
      )}

      {checkoutError && (
        <p className="mt-4 text-sm font-medium text-danger-600">{checkoutError}</p>
      )}

      {/* `plans` is null until the query returns. Rendering the empty case
          meanwhile told a parent "there are no plans yet" on the one screen
          where they are trying to pay us. */}
      {plans === null ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t('common.loading')}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <Skeleton className="h-52 rounded-3xl" />
          <Skeleton className="h-52 rounded-3xl" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      ) : (
        <PlanChooser
          plans={plans}
          interval={interval}
          onIntervalChange={setInterval}
          checkingOut={checkingOut}
          startingTrial={startingTrial}
          onCheckout={checkout}
          onStartTrial={startTrial}
        />
      )}
    </div>
  )
}

/**
 * One card per tier, with a monthly/annual switch above them.
 *
 * Previously every active plan got its own card, which was fine while
 * there were two and confusing the moment there were four: "Solo" and
 * "Solo (Annual)" read as separate products, and on a phone the annual
 * options sat below the fold where nobody scrolled. Grouping first means a
 * parent picks a tier and a billing period, which is the decision they are
 * actually making.
 */
function PlanChooser({
  plans,
  interval,
  onIntervalChange,
  checkingOut,
  startingTrial,
  onCheckout,
  onStartTrial,
}: {
  plans: SubscriptionPlan[]
  interval: BillingInterval
  onIntervalChange: (next: BillingInterval) => void
  checkingOut: string | null
  startingTrial: string | null
  onCheckout: (planId: string) => void
  onStartTrial: (planId: string) => void
}) {
  const { t } = useTranslation()
  const groups = groupPlansByTier(plans)

  if (groups.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">{t('parent.noPlansYet')}</p>
  }

  const showToggle = hasInterval(groups, 'monthly') && hasInterval(groups, 'annual')
  const bestSaving = Math.max(0, ...groups.map((g) => g.annualSavingCents ?? 0))

  // Tiers that have nothing at the selected interval are hidden rather than
  // shown as a dead card -- an annual-only tier has no monthly price to
  // put on one.
  const visible = groups.filter((g) => planFor(g, interval) !== null)

  return (
    <>
      {showToggle && (
        <BillingIntervalToggle
          value={interval}
          onChange={onIntervalChange}
          savingLabel={
            bestSaving > 0
              ? t('billing.saveUpTo', { amount: formatRand(bestSaving) })
              : undefined
          }
          className="mt-6"
        />
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {visible.map((group) => {
          const plan = planFor(group, interval)!
          const saving = interval === 'annual' ? group.annualSavingCents : null
          return (
            <Card key={group.key}>
              <p className="font-bold text-slate-900">{group.name}</p>
              <p className="mt-1 text-2xl font-extrabold text-brand-700">
                {plan.price_cents != null
                  ? formatRand(plan.price_cents)
                  : t('common.priceTbc')}
                <span className="text-sm font-medium text-slate-500">
                  {interval === 'monthly' ? t('billing.perMonth') : t('billing.perYear')}
                </span>
              </p>
              <p className="text-sm text-slate-500">
                {t('parent.maxLearnersOnPlan', { count: plan.max_learners })}
              </p>
              {saving != null && saving > 0 && (
                <p className="mt-1 text-sm font-semibold text-success-600">
                  {t('pricing.annualSavings', { amount: formatRand(saving) })}
                </p>
              )}
              <Button
                className="mt-4 w-full"
                disabled={checkingOut === plan.id}
                onClick={() => onCheckout(plan.id)}
              >
                {checkingOut === plan.id
                  ? t('common.loading')
                  : t('parent.subscribeWithPayfast')}
              </Button>
              <Button
                className="mt-2 w-full"
                variant="secondary"
                disabled={startingTrial === plan.id}
                onClick={() => onStartTrial(plan.id)}
              >
                {startingTrial === plan.id
                  ? t('common.loading')
                  : t('parent.startFreeTrial')}
              </Button>
            </Card>
          )
        })}
      </div>
    </>
  )
}
