// Guards pickCurrentSubscription, which decides what the parent's
// subscription page says about where they stand.
//
// It earns a check of its own because the thing it fixes is invisible in
// normal use and expensive when wrong: a paying customer being told they
// are not subscribed. The page used to read the newest subscription row of
// any status, and payfast-checkout writes an `incomplete` row before every
// redirect to PayFast, so one abandoned checkout was enough to mask a live
// subscription.
//
// The first two cases are the real production rows as they stood on
// 2026-10-06, kept verbatim so a regression shows up against real data
// rather than against fixtures invented to suit the code.
//
// Run: node --experimental-strip-types scripts/check-subscription-picker.mjs
import { pickCurrentSubscription } from '../src/lib/billing/currentSubscription.ts'

const NOW = Date.parse('2026-10-06T13:00:00Z')
const show = (s) => (s === null ? 'no card' : `${s.status}/${s.plan}`)

let failed = 0
function check(label, rows, want) {
  const got = show(pickCurrentSubscription(rows, NOW))
  if (got !== want) {
    failed++
    console.error(`FAIL  ${label}\n      got ${got}, want ${want}`)
  }
}

// Production, 2026-10-06: two abandoned checkouts and nothing else. The
// page used to show "incomplete" with a cancel button for this parent.
check(
  'only abandoned checkouts -> no card',
  [
    { status: 'incomplete', created_at: '2026-10-05T14:43:11.524313+00:00', trial_ends_at: null, current_period_end: null, plan: 'solo_monthly_2026' },
    { status: 'incomplete', created_at: '2026-10-05T14:43:33.196836+00:00', trial_ends_at: null, current_period_end: null, plan: 'family_annual_v2_2026' },
  ],
  'no card',
)

// Production, 2026-10-06: the owner's account -- expired trials, dead
// checkouts, four cancelled-but-live September rows, one active.
check(
  'twelve mixed rows -> the active one',
  [
    { status: 'trialing', created_at: '2026-09-11T06:12:39.749316+00:00', trial_ends_at: '2026-09-14T06:12:39.866+00:00', current_period_end: null, plan: 'family_monthly_2026' },
    { status: 'trialing', created_at: '2026-09-11T06:12:55.836438+00:00', trial_ends_at: '2026-09-14T06:12:56.207+00:00', current_period_end: null, plan: 'family_annual_2026' },
    { status: 'incomplete', created_at: '2026-09-11T06:17:48.693955+00:00', trial_ends_at: null, current_period_end: null, plan: 'family_monthly_2026' },
    { status: 'canceled', created_at: '2026-09-11T06:33:44.805556+00:00', trial_ends_at: null, current_period_end: '2026-10-11T06:34:03.974+00:00', plan: 'family_monthly_2026' },
    { status: 'incomplete', created_at: '2026-10-06T12:05:42.979206+00:00', trial_ends_at: null, current_period_end: null, plan: 'family_annual_v2_2026' },
    { status: 'active', created_at: '2026-10-06T12:12:18.868726+00:00', trial_ends_at: null, current_period_end: '2027-10-06T12:13:36.82+00:00', plan: 'tmp_annual_test' },
  ],
  'active/tmp_annual_test',
)

// The bug, in its simplest form.
check(
  'active, then a newer abandoned checkout -> still active',
  [
    { status: 'active', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: '2027-01-01T00:00:00Z', plan: 'solo_monthly_2026' },
    { status: 'incomplete', created_at: '2026-06-01T00:00:00Z', trial_ends_at: null, current_period_end: null, plan: 'family_monthly_v2_2026' },
  ],
  'active/solo_monthly_2026',
)

// A failed renewal is the one state worth interrupting someone for, so it
// must not hide behind a rosier row.
check(
  'past_due outranks a live trial',
  [
    { status: 'trialing', created_at: '2026-10-05T00:00:00Z', trial_ends_at: '2026-12-01T00:00:00Z', current_period_end: null, plan: 'trial' },
    { status: 'past_due', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: null, plan: 'solo_monthly_2026' },
  ],
  'past_due/solo_monthly_2026',
)

// Lapsed states are not subscriptions; those parents get the plan chooser.
check('expired trial -> no card', [{ status: 'trialing', created_at: '2026-01-01T00:00:00Z', trial_ends_at: '2026-02-01T00:00:00Z', current_period_end: null, plan: 'x' }], 'no card')
check('cancelled, period over -> no card', [{ status: 'canceled', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: '2026-02-01T00:00:00Z', plan: 'x' }], 'no card')
check('cancelled, period still running -> card', [{ status: 'canceled', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: '2026-12-01T00:00:00Z', plan: 'x' }], 'canceled/x')
check('trialing with no trial_ends_at is not a live trial', [{ status: 'trialing', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: null, plan: 'x' }], 'no card')

// Edges.
check('no rows', [], 'no card')
check('null', null, 'no card')
check(
  'two actives -> the later one',
  [
    { status: 'active', created_at: '2026-01-01T00:00:00Z', trial_ends_at: null, current_period_end: '2027-01-01T00:00:00Z', plan: 'old' },
    { status: 'active', created_at: '2026-09-01T00:00:00Z', trial_ends_at: null, current_period_end: '2027-09-01T00:00:00Z', plan: 'new' },
  ],
  'active/new',
)

if (failed) {
  console.error(`\nsubscription picker: ${failed} failed`)
  process.exit(1)
}
console.log('subscription picker ok: 11 cases, including the real production rows from 2026-10-06')
