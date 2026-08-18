import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { Button, Card } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

export function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_cents')
      .then(({ data }) => setPlans(data ?? []))
  }, [])

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-center text-3xl font-extrabold text-slate-900">Simple, family-friendly pricing</h1>
        <p className="mt-2 text-center text-slate-500">Start with a free trial — cancel anytime.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <p className="font-bold text-slate-900">{plan.name}</p>
              <p className="mt-2 text-3xl font-extrabold text-brand-700">
                {plan.price_cents != null ? `R${(plan.price_cents / 100).toFixed(0)}` : 'TBC'}
                <span className="text-base font-medium text-slate-500">
                  /{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">Up to {plan.max_learners} child profile(s)</p>
              <Link to="/sign-up" className="mt-4 block">
                <Button className="w-full">Get started</Button>
              </Link>
            </Card>
          ))}
          {plans.length === 0 && (
            <p className="col-span-2 text-center text-slate-400">Pricing plans are being finalised.</p>
          )}
        </div>
      </div>
    </MarketingShell>
  )
}
