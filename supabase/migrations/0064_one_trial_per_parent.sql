-- One free trial per parent. Right now there is no limit at all.
--
-- `SubscriptionPage.startTrial` does a bare insert, there is no unique
-- constraint on the table, and the two triggers that protect billing fields
-- (`subscriptions_guard_billing_fields`, `subscriptions_protect_billing_fields`)
-- are both BEFORE UPDATE, so neither one looks at an INSERT.
--
-- 0051 capped what a single row may claim -- `trial_ends_at` at most 30 days
-- out -- but said nothing about how many rows. `internal.has_paid_access()`
-- returns true for ANY row with status 'trialing' and trial_ends_at in the
-- future, and nothing ever moves a lapsed trial out of 'trialing'. So a
-- parent whose trial ends can start another one, and another, indefinitely:
-- free access forever, 30 days at a time, using nothing but the app's own
-- button and the public anon key.
--
-- This is not theoretical and it does not need bad intent. On 2026-10-12 a
-- real signup landed two 'trialing' rows on the same account within the same
-- day, simply by using the page.
--
-- THE RULE. A client may insert 'trialing' only if that parent has never had
-- a 'trialing' row. Deliberately keyed on trials alone, not on "has any
-- subscription": `payfast-checkout` leaves an 'incomplete' row behind on
-- every abandoned checkout, and a parent who starts a card payment, thinks
-- better of it, and then wants the trial instead should still get it.
--
-- `service_role` has BYPASSRLS, so the PayFast handlers are unaffected.
-- RESTRICTIVE, so it ANDs with the existing ownership policy rather than
-- replacing it -- same approach as 0051, and it only ever narrows.

-- A helper, because a policy on `subscriptions` that sub-queries
-- `subscriptions` re-enters row-level security on the same table. SECURITY
-- DEFINER reads past RLS, and the search_path is pinned.
create or replace function internal.parent_has_trialed(p_parent_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (
    select 1 from subscriptions
     where parent_id = p_parent_id
       and status = 'trialing'
  );
$$;

-- EXECUTE must be granted to `authenticated`. A policy's expression is
-- evaluated as the role doing the INSERT, not as the policy's owner, so if
-- that role cannot call the helper the whole insert fails with "permission
-- denied for function" -- which is not a tidy lockdown, it is an outage:
-- the first draft of this migration revoked EXECUTE and took down new
-- trials AND card checkout together. Caught by the test below before it
-- went anywhere. `anon` is not granted: it cannot insert here anyway
-- (`subscriptions_owner_insert` needs parent_id = auth.uid()), and either
-- way the row is refused.
revoke all on function internal.parent_has_trialed(uuid) from public, anon;
grant execute on function internal.parent_has_trialed(uuid) to authenticated;

create policy subscriptions_one_trial_per_parent on public.subscriptions
  as restrictive
  for insert
  with check (
    status <> 'trialing'
    or not internal.parent_has_trialed(parent_id)
  );

-- --------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO.
--
-- 1. It does not clean up the rows already there. Four accounts carry more
--    than one 'trialing' row from sandbox testing and from the 2026-10-12
--    signup above. They keep working; they are just now unrepeatable.
--
-- 2. Two inserts racing in separate transactions can still both pass the
--    check, because neither sees the other's uncommitted row. Sequential
--    clicks -- the realistic case, and the one that actually happened -- are
--    caught. Closing the race needs a unique index, which cannot be built
--    while the duplicates in (1) exist. Once they are gone:
--
--      create unique index concurrently subscriptions_one_trial_per_parent_idx
--        on public.subscriptions (parent_id)
--        where status = 'trialing';
--
--    Worth doing, but it is a second belt on a fastened buckle, not the fix.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- VERIFIED against the live database, each write rolled back by a sentinel
-- exception, with the row count checked as unchanged afterwards (16 rows, 6
-- trialing, before and after):
--
--   CASE 1  a parent who already trialled asks for another  -> refused by RLS
--   CASE 2  a parent who has never trialled, first trial    -> accepted
--   CASE 3  payfast-checkout opening an 'incomplete' row    -> accepted
--   CASE 4  client forging status='active' (0051's rule)    -> still refused
--
-- Cases 2 and 3 are the ones that matter: a guard that also blocks paying
-- customers is worse than the hole it closes.
-- --------------------------------------------------------------------------
