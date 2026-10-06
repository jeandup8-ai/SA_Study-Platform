import type { Database } from '@/types/database'

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']
export type BillingInterval = 'monthly' | 'annual'

/**
 * Pairs each plan with its other billing interval.
 *
 * Before the Solo/Family split there were exactly two active plans, one
 * monthly and one annual, and every pricing surface took that for granted:
 * `plans.find(p => p.billing_interval === 'monthly')` was the plan, not *a*
 * plan. With four plans that broke in two ways at once -- the landing page
 * rendered only the first of each interval, so the Family tier vanished
 * from it entirely, and the pricing page computed one annual saving from
 * the cheapest monthly plan and then printed it on every annual card.
 *
 * Grouping first makes both impossible: a surface renders one card per
 * tier, and each tier's saving is computed from its own two prices.
 *
 * Tiers are keyed on the plan name with a trailing "(Annual)" removed,
 * which is exactly how the names are built ("Solo" / "Solo (Annual)").
 * Deliberately not on max_learners -- a temporary test plan can share a
 * seat count with a real tier without being the same product.
 */
export interface PlanGroup {
  key: string
  /** The tier name, without the interval suffix. */
  name: string
  maxLearners: number
  monthly: SubscriptionPlan | null
  annual: SubscriptionPlan | null
  /** Annual saving against twelve months of this tier's own monthly price. */
  annualSavingCents: number | null
}

const ANNUAL_SUFFIX = /\s*\(annual\)\s*$/i

export function tierNameOf(plan: SubscriptionPlan): string {
  return plan.name.replace(ANNUAL_SUFFIX, '').trim()
}

export function groupPlansByTier(plans: SubscriptionPlan[]): PlanGroup[] {
  const byTier = new Map<string, PlanGroup>()

  for (const plan of plans) {
    const name = tierNameOf(plan)
    const key = name.toLowerCase()
    let group = byTier.get(key)
    if (!group) {
      group = {
        key,
        name,
        maxLearners: plan.max_learners,
        monthly: null,
        annual: null,
        annualSavingCents: null,
      }
      byTier.set(key, group)
    }
    if (plan.billing_interval === 'annual') group.annual = plan
    else group.monthly = plan
    // The monthly row is the better source for the tier's seat count: an
    // annual-only tier still reports its own, and a tier with both will
    // agree.
    if (plan.billing_interval === 'monthly') group.maxLearners = plan.max_learners
  }

  for (const group of byTier.values()) {
    const m = group.monthly?.price_cents
    const a = group.annual?.price_cents
    group.annualSavingCents = m != null && a != null && m * 12 > a ? m * 12 - a : null
  }

  // Cheapest tier first, by whichever price the tier actually has.
  return [...byTier.values()].sort((x, y) => tierPrice(x) - tierPrice(y))
}

function tierPrice(group: PlanGroup): number {
  return (
    group.monthly?.price_cents ?? group.annual?.price_cents ?? Number.MAX_SAFE_INTEGER
  )
}

/** The plan to charge for a tier at the selected interval, if it exists. */
export function planFor(
  group: PlanGroup,
  interval: BillingInterval,
): SubscriptionPlan | null {
  return interval === 'annual' ? group.annual : group.monthly
}

/** Whether any tier offers the given interval -- i.e. whether to show the toggle. */
export function hasInterval(groups: PlanGroup[], interval: BillingInterval): boolean {
  return groups.some((g) => planFor(g, interval) !== null)
}
