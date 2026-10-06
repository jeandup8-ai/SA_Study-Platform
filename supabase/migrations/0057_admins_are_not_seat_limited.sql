-- Admin accounts are not seat-limited.
--
-- internal.has_paid_access() short-circuits on internal.is_admin(), so an
-- admin reads every lesson without any subscription. internal.
-- enforce_learner_limit() had no such check, so the two gates disagreed:
-- an admin had unlimited content but only whatever seat count their best
-- entitled subscription granted, falling back to one.
--
-- That was an omission rather than a policy, and it was five days from
-- biting. The owner's four seats came from cancelled September sandbox
-- subscriptions whose paid period ends 2026-10-11; from the 12th the best
-- remaining entitled row was the R5 test plan at max_learners = 1. The
-- account would have silently dropped from four child profiles to one,
-- while still showing every lesson -- a confusing failure to diagnose,
-- because the content half of the gate would have looked perfectly fine.
--
-- Keyed on new.parent_id, not auth.uid(): the rule is a property of the
-- account that owns the learner, not of whoever performs the insert. That
-- keeps it true under the service role, where auth.uid() is null, and
-- stops an admin's elevated seats applying to a normal parent whose
-- learner they happen to be creating.
--
-- This grants nothing new in substance. Membership of `admins` is already
-- the trust boundary that hands out unconditional access to all content;
-- seats were the one place that boundary was not honoured.
--
-- Verified with real inserts inside a rolled-back subtransaction:
--   A  admin at 1 learner added 8 more (total 9, past every plan's 4)  PASS
--   B  non-admin with 1 seat and 1 learner blocked on the 2nd          PASS
--   C  admin creating a learner for a non-admin still capped           PASS
-- Probe rows left afterwards: 0.

create or replace function internal.enforce_learner_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  current_count integer;
  allowed_max integer;
begin
  -- Admin accounts are not seat-limited; see the migration header.
  if exists (select 1 from admins a where a.id = new.parent_id) then
    return new;
  end if;

  select count(*) into current_count from learners where parent_id = new.parent_id;

  select sp.max_learners into allowed_max
  from subscriptions s
  join subscription_plans sp on sp.id = s.plan_id
  where s.parent_id = new.parent_id
    and (
      s.status = 'active'
      or (s.status = 'trialing' and s.trial_ends_at > now())
      or (s.status = 'canceled' and s.current_period_end > now())
    )
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
$function$;
