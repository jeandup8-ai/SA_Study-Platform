-- ===========================================================================
-- RUN on 2026-10-13. 9 rows deleted, 7 remain. The unique index at the
-- bottom is built. DO NOT RUN AGAIN -- it names specific rows, and the ids
-- below no longer exist.
--
-- Kept for the record of what was removed and, more importantly, why the
-- seven survivors had to survive.
--
-- Verified afterwards: 1 active, 4 canceled, 2 trialing (one per parent),
-- 0 incomplete; all 5 payment_events intact; jeandup8 still entitled via
-- the active subscription and zyliaduplessis still on their live trial to
-- 2026-10-15; internal.parent_has_trialed() still true for both, so neither
-- can mint a second free trial.
--
-- info@legendsupplies.co.za is now at zero rows and IS trial-eligible. That
-- is correct, not a regression: they only ever had abandoned checkouts and
-- have never taken a trial.
-- ===========================================================================

-- One-off cleanup of dead subscription rows. NOT a migration: it names
-- specific rows in this database, so it must not re-run anywhere else.
--
-- Checked on 2026-10-13. 16 rows: 9 go, 7 stay.
--
-- WHAT STAYS, AND WHY -- read this before changing the list.
--
--   4 'canceled' rows (48642ce4, cd5c20c2, 866820ed, 70d1413c)
--     Each has a payment_event attached. These are not junk, they are the
--     record of money that actually moved. payment_events.subscription_id
--     is ON DELETE NO ACTION, so the delete would be refused anyway -- but
--     the real reason is that destroying transaction history to tidy a list
--     is the wrong trade.
--
--   1 'active' row (e1ead919)
--     The live paid subscription, paid to 2027-10-06.
--
--   2 'trialing' rows (5e1c6da5, e839711e) -- the oldest one per parent
--     THIS IS THE SUBTLE ONE. Migration 0064 decides "has this parent had
--     their free trial?" by asking whether any 'trialing' row exists for
--     them. Delete every trialing row for a parent and they become eligible
--     for a brand-new free trial. So one row per parent is kept
--     deliberately, as the marker that their trial is spent.
--     e839711e is also a live trial (ends 2026-10-15) for a real signup.
--
-- WHAT GOES: 5 abandoned checkouts ('incomplete' grants nothing), 3 expired
-- duplicate trials, and 1 duplicate of a live trial. None has payment
-- history; none grants access.

-- ---------------------------------------------------------------- PREVIEW
-- Run this on its own first and read the 9 rows.
select s.id, p.email, s.status, s.created_at::date
from public.subscriptions s
left join public.parents p on p.id = s.parent_id
where s.id in (
  '120facdc-83bb-4d9d-ab1c-b7818d410abe',  -- legendsupplies, abandoned checkout
  '0aa78ed1-ae7e-4bd7-af19-ddf58ccb0fd4',  -- legendsupplies, abandoned checkout
  'e03fc78e-0fc2-42d8-8b9a-de6bf9be692e',  -- jeandup8, abandoned checkout
  'e14563b8-2256-449a-beec-c7bffbb7e910',  -- jeandup8, abandoned checkout
  'ee699105-9ada-4c4a-b971-f4f6dcbe4ee1',  -- jeandup8, abandoned checkout
  'aaaaa42f-958f-4487-9cc7-d95702fadb5b',  -- jeandup8, expired duplicate trial
  '7dea5d40-59f2-4f35-8908-25780b79c113',  -- jeandup8, expired duplicate trial
  '447be498-ba15-4829-bcb5-6f89331d9513',  -- jeandup8, expired duplicate trial
  '8f5834fd-0e18-4960-b1c4-36582efca940'   -- zyliaduplessis, duplicate of a live trial
)
order by p.email, s.status, s.created_at;

-- ----------------------------------------------------------------- DELETE
-- Transactional on purpose. If the count is not 9, something has changed
-- since 2026-10-13: ROLLBACK and look, do not COMMIT.
begin;

with deleted as (
  delete from public.subscriptions s
  where s.id in (
    '120facdc-83bb-4d9d-ab1c-b7818d410abe',
    '0aa78ed1-ae7e-4bd7-af19-ddf58ccb0fd4',
    'e03fc78e-0fc2-42d8-8b9a-de6bf9be692e',
    'e14563b8-2256-449a-beec-c7bffbb7e910',
    'ee699105-9ada-4c4a-b971-f4f6dcbe4ee1',
    'aaaaa42f-958f-4487-9cc7-d95702fadb5b',
    '7dea5d40-59f2-4f35-8908-25780b79c113',
    '447be498-ba15-4829-bcb5-6f89331d9513',
    '8f5834fd-0e18-4960-b1c4-36582efca940'
  )
  -- Belt and braces. The id list above is already correct; these two make
  -- it impossible for a stale list to do real damage.
  and not exists (
    select 1 from public.payment_events pe where pe.subscription_id = s.id
  )
  and s.status <> 'active'
  returning s.id, s.status
)
select count(*) as rows_deleted, 9 as expected from deleted;

-- Read the number above.
--   9  -> commit;
--   anything else -> rollback;
commit;

-- ------------------------------------------------------------- AFTERWARDS
-- Expect 7 rows left: 1 active, 4 canceled, 2 trialing (one per parent).
select status, count(*) from public.subscriptions group by status order by status;

-- With the duplicate trials gone there is now at most one 'trialing' row per
-- parent, so the index 0064 could not build can be built. It closes the last
-- gap in that migration: two trial inserts racing in separate transactions,
-- where neither sees the other's uncommitted row.
create unique index concurrently if not exists subscriptions_one_trial_per_parent_idx
  on public.subscriptions (parent_id)
  where status = 'trialing';
