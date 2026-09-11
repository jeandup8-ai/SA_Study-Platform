-- The client already checks a parent's plan max_learners before offering the
-- "create profile" form (see LearnerContext.createLearner), but that check is
-- only ever advisory -- a direct API/curl call to the learners table bypassed
-- it entirely, which is how a parent ended up with more child profiles than
-- any subscription plan actually allows. This trigger is the real
-- enforcement.
--
-- A parent with no subscriptions row yet (trial not started) falls back to 4
-- -- the max_learners of both currently-active plans (family_monthly_2026,
-- family_annual_2026). If a lower-tier plan is ever reintroduced, this still
-- reads the real number from subscription_plans for parents who have one.

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
  order by s.created_at desc
  limit 1;

  if allowed_max is null then
    allowed_max := 4;
  end if;

  if current_count >= allowed_max then
    raise exception 'learner_limit_reached';
  end if;

  return new;
end;
$$;

drop trigger if exists learners_enforce_limit on learners;
create trigger learners_enforce_limit
before insert on learners
for each row execute function internal.enforce_learner_limit();
