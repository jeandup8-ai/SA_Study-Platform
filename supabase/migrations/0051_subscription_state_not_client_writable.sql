-- Stop the browser being able to insert itself a paid subscription.
--
-- A CORRECTION TO THIS MIGRATION'S FIRST DRAFT. The first version of this
-- file claimed both INSERT and UPDATE were forgeable. Only INSERT was. The
-- UPDATE path was already protected by a trigger that predates this work,
-- `internal.protect_subscription_billing_fields()`, which raises if any
-- non-`service_role` caller changes status, plan, trial end, period end,
-- provider fields or parent_id. The original audit read the RLS policies
-- and did not look at the triggers, which is how a protection that was
-- already there came to be reported as missing. The audit was half wrong;
-- the half that was right is the half this migration fixes.
--
-- WHAT WAS ACTUALLY WRONG. `subscriptions_owner_insert` checked only
-- `parent_id = auth.uid()`. Every other column was free on INSERT, and the
-- existing trigger is BEFORE UPDATE, so it never fired. Any signed-in
-- parent could run, with nothing but their own session and the public anon
-- key:
--
--   insert into subscriptions (parent_id, status, current_period_end)
--   values (auth.uid(), 'active', '2099-01-01');
--
-- and the row was accepted. `SubscriptionPage` would show "Active", and
-- `LearnerContext` would read the attached plan's `max_learners` from it.
-- The blast radius today is small, because no learning content is gated on
-- subscription status -- but the moment a paywall is added that insert
-- becomes a free lifetime subscription, and the hole would be in the schema
-- rather than in the new code.
--
-- WHO LEGITIMATELY INSERTS WHAT. Checked against every caller in the repo:
--
--   SubscriptionPage.startTrial  (user JWT)  status='trialing'
--   payfast-checkout             (user JWT)  status='incomplete',
--                                            provider='payfast'
--   payfast-itn                  (service)   never inserts; only updates
--
-- So no legitimate client insert ever names a paid state. Both keep
-- working under the rule below.
--
-- WHY A RESTRICTIVE POLICY RATHER THAN REPLACING THE PERMISSIVE ONE.
-- Additive. `subscriptions_owner_insert` keeps saying who owns the row;
-- this says what a client may claim about it, and PostgreSQL ANDs a
-- RESTRICTIVE policy with the permissive ones. Nothing is dropped, so
-- there is no window during deployment where the table is unprotected, and
-- the ownership rule and the billing rule stay readable as two separate
-- ideas. `service_role` has BYPASSRLS, so the PayFast handlers are
-- unaffected.
--
-- This migration only ever narrows.

create policy subscriptions_no_client_paid_state on public.subscriptions
  as restrictive
  for insert
  with check (
    -- 'active', 'past_due' and 'canceled' are the payment provider's words,
    -- not the client's. 'incomplete' is what payfast-checkout opens a
    -- pending checkout with; it grants nothing on its own.
    status in ('trialing', 'incomplete')
    -- A paid period is something the ITN handler records after money moved.
    and current_period_end is null
    and provider_subscription_id is null
    -- Bounded so a client cannot hand itself a ten-year "trial".
    -- TRIAL_DAYS is 3 (src/lib/billing/trial.ts); 30 days leaves room for a
    -- promotional trial without leaving room for abuse.
    and (trial_ends_at is null or trial_ends_at <= now() + interval '30 days')
  );

-- --------------------------------------------------------------------------
-- NOT APPLIED, AND DELIBERATELY SO.
--
-- The first draft of this migration also added
-- `internal.guard_subscription_billing_fields()` as a second BEFORE UPDATE
-- trigger. It was applied to the live database before
-- `protect_subscription_billing_fields` was discovered, and the session
-- that applied it was not permitted to drop it again, so BOTH triggers are
-- currently live on `public.subscriptions`.
--
-- That is redundant but not harmful, and specifically it does not widen
-- anything. Triggers fire in alphabetical order, so `guard_` runs first and
-- `protect_` second. `guard_` lets an admin through where `protect_` does
-- not -- but because `protect_` still runs afterwards and still raises, the
-- net behaviour for every caller is exactly the pre-existing, stricter one.
-- The only thing `guard_` adds is that `promo_code` is now protected too,
-- which no caller in this repo writes from the client.
--
-- HOUSEKEEPING FOR WHOEVER HAS DATABASE ACCESS: drop the duplicate, keeping
-- the original. It is a tidy-up, not a fix.
--
--   drop trigger if exists subscriptions_guard_billing_fields
--     on public.subscriptions;
--   drop function if exists internal.guard_subscription_billing_fields();
-- --------------------------------------------------------------------------
