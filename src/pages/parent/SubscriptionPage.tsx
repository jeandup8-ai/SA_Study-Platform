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
import { pickCurrentSubscription } from '@/lib/billing/currentSubscription'

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
  // Ever had one, not has one now. Defaults to true so a parent never sees
  // the trial button for the instant before the rows arrive -- offering a
  // trial and then withdrawing it reads worse than showing it a beat late.
  const [trialUsed, setTrialUsed] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  // All of them, not the newest one: a parent accumulates an `incomplete`
  // row per abandoned checkout, and pickCurrentSubscription decides which
  // row actually describes where they stand. See that module for why.
  function loadSubscription() {
    if (!parent) return
    supabase
      .from('subscriptions')
      .select('*')
      .eq('parent_id', parent.id)
      .then(({ data }) => {
        setSubscription(pickCurrentSubscription(data))
        // A lapsed trial still counts as used -- nothing ever moves a row
        // out of 'trialing', and that is exactly the rule the database
        // enforces on insert (migration 0064), so the two agree.
        setTrialUsed((data ?? []).some((row) => row.status === 'trialing'))
      })
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

  /**
   * One trial per parent, enforced in the database (migration 0064) and
   * mirrored here.
   *
   * `trialUsed` below hides the button once a trial exists, but the button
   * is not the gate -- a RESTRICTIVE insert policy is, because anyone can
   * POST to the REST API with the public anon key. What this does is keep
   * the refusal legible instead of mysterious.
   *
   * The error is read, not discarded. The previous version destructured only
   * `data`, so a refused insert set the subscription to null and the page
   * silently lost the trial the parent already had -- an invisible failure
   * before 0064, and a guaranteed one after it.
   */
  async function startTrial(planId: string) {
    if (!parent) return
    setStartingTrial(planId)
    setCheckoutError(null)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)
    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        parent_id: parent.id,
        plan_id: planId,
        status: 'trialing',
        trial_ends_at: trialEnd.toISOString(),
      })
      .select('*')
      .single()
    if (error) {
      // Row-level security refuses with 42501. Anything else is unexpected,
      // so say something true but general rather than guessing.
      setCheckoutError(
        error.code === '42501' ? t('parent.trialAlreadyUsed') : t('parent.trialFailed'),
      )
      // Re-read rather than trusting local state: whatever the database
      // thinks is authoritative, and it just disagreed with us.
      loadSubscription()
      setStartingTrial(null)
      return
    }
    setSubscription(data)
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

  // 'incomplete' is gone: pickCurrentSubscription never surfaces an
  // abandoned checkout, so offering to cancel one is dead code.
  const isPayingStatus =
    subscription && ['active', 'past_due'].includes(subscription.status)

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
          trialUsed={trialUsed}
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
  trialUsed,
  onCheckout,
  onStartTrial,
}: {
  plans: SubscriptionPlan[]
  interval: BillingInterval
  onIntervalChange: (next: BillingInterval) => void
  checkingOut: string | null
  startingTrial: string | null
  /** Their one trial is spent, so don't offer a second (migration 0064). */
  trialUsed: boolean
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
              {/* The trial is once per parent. Showing the button to
                  someone who has already had theirs only sets up a
                  refusal. */}
              {!trialUsed && (
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
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}
