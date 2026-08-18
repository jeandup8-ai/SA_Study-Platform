import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button, Card, Badge } from '@/components/ui'
import type { Subscription } from '@/types/curriculum'
import type { Database } from '@/types/database'

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

export function SubscriptionPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('subscription_plans').select('*').eq('is_active', true).then(({ data }) => setPlans(data ?? []))
    if (parent) {
      supabase
        .from('subscriptions')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setSubscription(data))
    }
  }, [parent])

  async function startTrial(planId: string) {
    if (!parent) return
    setStarting(planId)
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)
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
    setStarting(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900">{t('parent.manageSubscription')}</h1>

      {subscription && (
        <Card className="mt-4 bg-brand-50">
          <Badge tone={subscription.status === 'trialing' ? 'sun' : 'success'}>{subscription.status}</Badge>
          {subscription.trial_ends_at && (
            <p className="mt-2 text-sm text-brand-800">
              Trial ends {new Date(subscription.trial_ends_at).toLocaleDateString()}
            </p>
          )}
        </Card>
      )}

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        No payment provider is connected yet — starting a plan below records intent only, it does not
        charge a card. Wiring a real South African payment provider (e.g. Paystack / PayFast / Peach
        Payments) is a follow-up integration step.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <p className="font-bold text-slate-900">{plan.name}</p>
            <p className="mt-1 text-2xl font-extrabold text-brand-700">
              {plan.price_cents != null
                ? `R${(plan.price_cents / 100).toFixed(0)}`
                : 'TBC'}
              <span className="text-sm font-medium text-slate-500">
                /{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}
              </span>
            </p>
            <p className="text-sm text-slate-500">Up to {plan.max_learners} child profile(s)</p>
            <Button
              className="mt-4 w-full"
              variant="secondary"
              disabled={starting === plan.id}
              onClick={() => startTrial(plan.id)}
            >
              {starting === plan.id ? t('common.loading') : 'Start free trial'}
            </Button>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-sm text-slate-400">No plans published yet.</p>}
      </div>
    </div>
  )
}
