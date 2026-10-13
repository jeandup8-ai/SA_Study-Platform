-- Finish the tidy-up 0051 asked for, without losing the one thing the
-- duplicate was actually doing.
--
-- 0051 found two BEFORE UPDATE triggers on subscriptions doing nearly the
-- same job, and said to drop `guard_` and keep `protect_`. Nearly is the
-- operative word. `protect_` covers status, plan_id, trial_ends_at,
-- current_period_end, provider, provider_customer_id,
-- provider_subscription_id and parent_id. `guard_` covered all of those
-- plus `promo_code`. Dropping it as "redundant" would have quietly handed
-- promo_code to the client.
--
-- Nothing reads promo_code today -- it has been an unused column since
-- 0004. That is the argument for protecting it now, while it is free,
-- rather than the day someone wires it to a discount.
--
-- cancel_requested_at is deliberately NOT protected. payfast-cancel writes
-- it with the caller's own JWT rather than the service key
-- (functions/payfast-cancel/index.ts:159), so adding it to this list would
-- break the cancel button. Only the status change later in that function
-- runs as service_role. I nearly added it; the test below is what stopped
-- me.

drop trigger if exists subscriptions_guard_billing_fields on public.subscriptions;
drop function if exists internal.guard_subscription_billing_fields();

-- Also removed: test scaffolding left behind while proving 0064.
drop function if exists internal.tmp_test_trial_guard();

create or replace function internal.protect_subscription_billing_fields()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.plan_id is distinct from old.plan_id
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.current_period_end is distinct from old.current_period_end
     or new.provider is distinct from old.provider
     or new.provider_customer_id is distinct from old.provider_customer_id
     or new.provider_subscription_id is distinct from old.provider_subscription_id
     or new.parent_id is distinct from old.parent_id
     or new.promo_code is distinct from old.promo_code
  then
    raise exception 'Only the payment system can change subscription billing fields';
  end if;
  return new;
end;
$function$;

-- --------------------------------------------------------------------------
-- VERIFIED against live data, every write rolled back by a sentinel, and the
-- active subscription confirmed byte-for-byte unchanged afterwards:
--
--   1  parent sets cancel_requested_at (user JWT)  -> accepted   (cancel works)
--   2  parent sets promo_code                      -> refused    (gap closed)
--   3  parent extends current_period_end 10 years  -> refused    (no regression)
--   4  service_role sets status/period/promo/token -> accepted   (ITN works)
--
-- Case 4 failed on the first run and it was the test, not the trigger:
-- `reset role` does not clear request.jwt.claims, so auth.role() saw no role
-- claim and the trigger correctly refused. Re-run with
-- '{"role":"service_role"}' it passes. Worth knowing for the next person who
-- tests a trigger that branches on auth.role(): a plain SQL session with no
-- claims is NOT service_role, and will be refused by this trigger.
-- --------------------------------------------------------------------------
