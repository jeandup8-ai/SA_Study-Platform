-- Count seats from the subscription a parent is actually entitled to.
--
-- WHY NOW. The existing trigger (0041) reads the parent's *newest*
-- subscription row, of any status:
--
--   order by s.created_at desc limit 1
--
-- That has been harmless only because both active plans allow 4 learners,
-- so every row produced the same answer. Introducing a Solo tier makes the
-- row choice load-bearing, and the current choice is wrong in both
-- directions:
--
--   UPGRADE FOR FREE. payfast-checkout inserts status='incomplete' with the
--   chosen plan_id *before* any payment. A parent on Solo could start a
--   Family checkout, abandon it at PayFast, and keep the Family seat count
--   having paid nothing -- the abandoned row is the newest one.
--
--   SILENT DOWNGRADE. A parent with an active Family subscription who opens
--   a Solo checkout immediately drops to the Solo limit, because that
--   incomplete row is now newest. Their existing children stay (the trigger
--   is INSERT-only) but they can no longer add one.
--
-- Two changes fix both. Only entitled subscriptions are considered, using
-- the same three-branch rule as internal.has_paid_access() so seats and
-- access can never disagree about which subscription counts. And the pick
-- is `order by max_learners desc` rather than by date, so a parent holding
-- more than one entitled subscription gets the most generous one instead of
-- whichever happens to be newest.
--
-- THE FALLBACK ALSO CHANGES, from 4 to 1. A parent with no entitled
-- subscription previously got four seats by default, which under flat
-- family pricing was merely generous and under seat pricing is the whole
-- product for free. One seat is what onboarding needs: a new parent creates
-- their first child profile, then picks a plan, and the plan decides
-- everything after that.

create or replace function internal.enforce_learner_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  allowed_max integer;
begin
  select count(*) into current_count from learners where parent_id = new.parent_id;

  select sp.max_learners into allowed_max
  from subscriptions s
  join subscription_plans sp on sp.id = s.plan_id
  where s.parent_id = new.parent_id
    -- Identical to internal.has_paid_access(). An unpaid, abandoned or
    -- expired subscription buys no seats, exactly as it buys no lessons.
    and (
      s.status = 'active'
      or (s.status = 'trialing' and s.trial_ends_at > now())
      or (s.status = 'canceled' and s.current_period_end > now())
    )
  -- Most generous entitled plan, not the most recent row.
  order by sp.max_learners desc
  limit 1;

  if allowed_max is null then
    allowed_max := 1;
  end if;

  if current_count >= allowed_max then
    raise exception 'learner_limit_reached';
  end if;

  return new;
end;
$$;

comment on function internal.enforce_learner_limit() is
  'Server-side seat limit. Counts only subscriptions that currently grant entitlement (same rule as internal.has_paid_access()), takes the most generous such plan, and falls back to 1 seat when none applies.';
