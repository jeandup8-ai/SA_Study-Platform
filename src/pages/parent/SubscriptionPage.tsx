import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button, Card, Badge } from '@/components/ui'
import type { Subscription } from '@/types/curriculum'
import type { Database } from '@/types/database'

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
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [startingTrial, setStartingTrial] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

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
    supabase.from('subscription_plans').select('*').eq('is_active', true).order('price_cents').then(({ data }) => setPlans(data ?? []))
    loadSubscription()
  }, [parent])

  async function startTrial(planId: string) {
    if (!parent) return
    setStartingTrial(planId)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 3)
    const { data } = await supabase
      .from('subscriptions')
      .insert({ parent_id: parent.id, plan_id: planId, status: 'trialing', trial_ends_at: trialEnd.toISOString() })
      .select('*')
      .single()
    setSubscription(data ?? null)
    setStartingTrial(null)
  }

  async function checkout(planId: string) {
    setCheckingOut(planId)
    setCheckoutError(null)
    const { data, error } = await supabase.functions.invoke('payfast-checkout', { body: { planId } })
    setCheckingOut(null)
    if (error || !data?.action || !data?.fields) {
      setCheckoutError(
        data?.error === 'feature_not_configured'
          ? 'Card payment is not switched on yet -- start a free trial instead, or contact us.'
          : 'Something went wrong starting checkout. Please try again.',
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

  const isPayingStatus = subscription && ['active', 'past_due', 'incomplete'].includes(subscription.status)

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900">{t('parent.manageSubscription')}</h1>

      {paymentResult === 'success' && (
        <Card className="mt-4 bg-green-50">
          <p className="text-sm text-green-800">
            Thanks! We're confirming your payment with PayFast now -- this usually only takes a few
            seconds. Refresh this page shortly if your status below doesn't update automatically.
          </p>
        </Card>
      )}
      {paymentResult === 'cancelled' && (
        <Card className="mt-4 bg-amber-50">
          <p className="text-sm text-amber-800">Checkout was cancelled -- no payment was made.</p>
        </Card>
      )}

      {subscription && (
        <Card className="mt-4 bg-brand-50">
          <Badge tone={subscription.status === 'active' ? 'success' : subscription.status === 'trialing' ? 'sun' : 'warning'}>
            {t(`parent.subscriptionStatus.${subscription.status}`)}
          </Badge>
          {subscription.trial_ends_at && subscription.status === 'trialing' && (
            <p className="mt-2 text-sm text-brand-800">
              Trial ends {new Date(subscription.trial_ends_at).toLocaleDateString()}
            </p>
          )}
          {subscription.current_period_end && subscription.status === 'active' && (
            <p className="mt-2 text-sm text-brand-800">
              Next billing date {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
          {subscription.cancel_requested_at && (
            <p className="mt-2 text-sm text-brand-800">Cancellation requested -- this will not renew further.</p>
          )}
          {isPayingStatus && !subscription.cancel_requested_at && (
            <Button className="mt-3" variant="secondary" disabled={canceling} onClick={cancelSubscription}>
              {canceling ? t('common.loading') : 'Cancel subscription'}
            </Button>
          )}
        </Card>
      )}

      {checkoutError && <p className="mt-4 text-sm text-red-600">{checkoutError}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <p className="font-bold text-slate-900">{plan.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-brand-700">
              {plan.price_cents != null ? `R${(plan.price_cents / 100).toFixed(0)}` : 'TBC'}
              <span className="text-sm font-medium text-slate-500">/{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}</span>
            </p>
            <p className="text-sm text-slate-500">Up to {plan.max_learners} child profile(s)</p>
            <Button
              className="mt-4 w-full"
              disabled={checkingOut === plan.id}
              onClick={() => checkout(plan.id)}
            >
              {checkingOut === plan.id ? t('common.loading') : 'Subscribe with PayFast'}
            </Button>
            <Button
              className="mt-2 w-full"
              variant="secondary"
              disabled={startingTrial === plan.id}
              onClick={() => startTrial(plan.id)}
            >
              {startingTrial === plan.id ? t('common.loading') : 'Start free trial'}
            </Button>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-sm text-slate-400">No plans published yet.</p>}
      </div>
    </div>
  )
}
