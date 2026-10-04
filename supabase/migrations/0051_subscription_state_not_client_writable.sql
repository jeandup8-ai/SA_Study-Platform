-- Stop the browser being able to grant itself a paid subscription.
--
-- THE PROBLEM. `subscriptions_owner_insert` and `subscriptions_owner_update`
-- checked only `parent_id = auth.uid()`. Every other column was free. Any
-- signed-in parent could therefore run, with nothing but their own session
-- and the public anon key:
--
--   insert into subscriptions (parent_id, status, current_period_end)
--   values (auth.uid(), 'active', '2099-01-01');
--
-- and the row would be accepted. `SubscriptionPage` would then show
-- "Active", and `LearnerContext` would read the attached plan's
-- `max_learners` off it. Today the blast radius is small, because no
-- learning content is gated on subscription status -- but the moment a
-- paywall is added, that insert becomes a free lifetime subscription, and
-- the hole would be in the schema rather than in the new code, which is the
-- worst place for it to hide.
--
-- WHO LEGITIMATELY WRITES WHAT. Checked against every caller in the repo:
--
--   SubscriptionPage.startTrial  (user JWT)    insert status='trialing'
--   payfast-checkout             (user JWT)    insert status='incomplete',
--                                              provider='payfast'
--   payfast-cancel               (user JWT)    update cancel_requested_at
--   payfast-cancel               (service)     update status='canceled'
--   payfast-itn                  (service)     update status active /
--                                              past_due / canceled,
--                                              current_period_end
--
-- So every transition that means "this person has paid" already happens
-- under the service role, which bypasses RLS. Nothing below changes what
-- those functions can do; it only removes the ability of a *browser* to
-- make the same claims.
--
-- This migration only ever narrows. No policy is widened, and no policy on
-- any other table is touched.

-- --------------------------------------------------------------------------
-- INSERT: a client may open a trial or begin a checkout, nothing else.
-- --------------------------------------------------------------------------
drop policy if exists subscriptions_owner_insert on public.subscriptions;

create policy subscriptions_owner_insert on public.subscriptions
  for insert
  with check (
    parent_id = auth.uid()
    -- 'active', 'past_due' and 'canceled' are the payment provider's words,
    -- not the client's. 'incomplete' is what payfast-checkout opens a
    -- pending checkout with; it grants nothing on its own.
    and status in ('trialing', 'incomplete')
    -- A paid period is something the ITN handler records after money moved.
    and current_period_end is null
    and provider_subscription_id is null
    -- Bounded so a client cannot hand itself a ten-year "trial".
    -- TRIAL_DAYS is 3 (src/lib/billing/trial.ts); 30 days leaves room for a
    -- promotional trial without leaving room for abuse.
    and (trial_ends_at is null or trial_ends_at <= now() + interval '30 days')
  );

-- --------------------------------------------------------------------------
-- UPDATE: the row stays scoped to its owner, and the billing columns become
-- read-only to anyone holding a user session.
--
-- A trigger rather than a WITH CHECK expression, because a policy cannot see
-- the old row and the new row at the same time -- "did this column change"
-- is not expressible in RLS.
-- --------------------------------------------------------------------------
create or replace function internal.guard_subscription_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null under the service role, which is how the PayFast ITN
  -- handler and the cancellation function run. Admins are allowed through
  -- so support can correct a row by hand.
  if auth.uid() is null or internal.is_admin() then
    return new;
  end if;

  if new.parent_id is distinct from old.parent_id
     or new.status is distinct from old.status
     or new.plan_id is distinct from old.plan_id
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.provider is distinct from old.provider
     or new.provider_customer_id is distinct from old.provider_customer_id
     or new.provider_subscription_id is distinct from old.provider_subscription_id
     or new.promo_code is distinct from old.promo_code
  then
    -- Raised rather than silently reverted: a legitimate caller never hits
    -- this, so reaching it means a bug or an attempt, and both are worth
    -- surfacing instead of swallowing.
    raise exception
      'subscription billing state is set by the payment provider, not the client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function internal.guard_subscription_billing_fields() is
  'Makes subscription billing columns read-only to user sessions. Only the service role (PayFast ITN / cancellation) and admins may change status, plan, period or provider fields. Clients may still set cancel_requested_at.';

drop trigger if exists subscriptions_guard_billing_fields on public.subscriptions;

create trigger subscriptions_guard_billing_fields
  before update on public.subscriptions
  for each row
  execute function internal.guard_subscription_billing_fields();
