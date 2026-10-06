import type { Database } from '@/types/database'

export type Subscription = Database['public']['Tables']['subscriptions']['Row']

/**
 * Which of a parent's subscription rows actually describes their standing.
 *
 * This page used to take the newest row of any status, which was fine
 * while a parent only ever had one. They don't: payfast-checkout inserts
 * an `incomplete` row *before* redirecting to PayFast, so every abandoned
 * checkout leaves one behind for good. A paying customer who later clicked
 * Subscribe again and changed their mind ended up with an `incomplete` row
 * newer than their `active` one, and their own subscription page then told
 * them their status was incomplete, hid their next billing date, and
 * offered to cancel -- while they were fully paid up.
 *
 * So rank by what a row means rather than when it was written. Access was
 * never affected (the entitlement check in the database is an EXISTS over
 * every row, so it already ignored ordering); this is about the page
 * telling the truth.
 *
 * `incomplete` and anything lapsed deliberately rank as nothing at all. An
 * abandoned checkout is not a subscription, and showing it as one is the
 * bug. Those parents see the plan chooser, which is what they need.
 *
 * past_due ranks above a live trial on purpose: it means a renewal failed
 * and we want their money. It is the one state worth interrupting someone
 * for, so it must never be hidden behind a rosier row.
 */
function rank(s: Subscription, now: number): number {
  switch (s.status) {
    case 'active':
      return 4
    case 'past_due':
      return 3
    case 'trialing':
      return s.trial_ends_at && Date.parse(s.trial_ends_at) > now ? 2 : 0
    case 'canceled':
      return s.current_period_end && Date.parse(s.current_period_end) > now ? 1 : 0
    default:
      return 0
  }
}

export function pickCurrentSubscription(
  rows: Subscription[] | null | undefined,
  now: number = Date.now(),
): Subscription | null {
  if (!rows?.length) return null

  let best: Subscription | null = null
  let bestRank = 0

  for (const row of rows) {
    const r = rank(row, now)
    if (r === 0) continue
    // Ties break on the newer row: two active subscriptions means an
    // upgrade went through, and the later one is the one they are on.
    if (r > bestRank || (r === bestRank && best && row.created_at > best.created_at)) {
      best = row
      bestRank = r
    }
  }

  return best
}
