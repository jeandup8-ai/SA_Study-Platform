-- Sweep abandoned checkout rows, weekly.
--
-- `payfast-checkout` inserts a status='incomplete' row every time someone
-- opens a checkout, and only an ITN ever moves it on. Every abandoned or
-- retried checkout therefore leaves one behind, permanently. Five had
-- accumulated across three accounts before launch, from a handful of test
-- payments; at real volume this only goes one way.
--
-- WHY 30 DAYS AND NOT 1. The first number I reached for was "older than a
-- day", and it was wrong in a way worth writing down. The ITN handler does
-- two things with that row: it inserts a payment_events row carrying
-- subscription_id as a FOREIGN KEY, then updates the subscription by id.
-- Delete the row first and the payment_events insert violates the
-- constraint, so the handler errors, PayFast retries and eventually gives
-- up -- the customer has paid and has nothing, and the activation is lost
-- with it. The row is created when checkout OPENS, not when money moves, so
-- the gap between the two is however long the person takes. These rows cost
-- nothing to keep. 30 days buys a wide margin against a failure whose cost
-- is somebody's money.
--
-- WHAT IT WILL NOT TOUCH, and this one is load-bearing: expired 'trialing'
-- rows. They look just as dead, and they are not. Migration 0064 decides
-- whether a parent has already had their free trial by asking whether any
-- 'trialing' row exists for them, so a job that tidied those away would
-- quietly hand every lapsed parent a fresh free trial, for ever, on a
-- schedule. Only 'incomplete' is swept.

create or replace function internal.sweep_abandoned_checkouts(
  p_older_than interval default interval '30 days'
)
  returns integer
  language plpgsql
  -- SECURITY INVOKER on purpose. This function deletes subscriptions, so it
  -- should carry no privilege of its own: it works because pg_cron runs it
  -- as a role with BYPASSRLS. Called as `authenticated` it deletes nothing,
  -- because `subscriptions` has no DELETE policy at all.
  set search_path to 'public'
as $$
declare
  v_removed integer;
begin
  with swept as (
    delete from public.subscriptions s
    where s.status = 'incomplete'
      and s.created_at < now() - p_older_than
      -- Belt and braces. Any of these being set means this row is not an
      -- abandoned checkout, whatever its status says.
      and s.provider_subscription_id is null
      and s.current_period_end is null
      and s.trial_ends_at is null
      and not exists (
        select 1 from public.payment_events pe where pe.subscription_id = s.id
      )
    returning s.id
  )
  select count(*) into v_removed from swept;

  if v_removed > 0 then
    raise log 'sweep_abandoned_checkouts: removed % abandoned checkout row(s) older than %',
      v_removed, p_older_than;
  end if;

  return v_removed;
end;
$$;

revoke all on function internal.sweep_abandoned_checkouts(interval) from public, anon, authenticated;

-- Sundays 03:40 UTC (05:40 SAST). Off the hour and off the existing
-- weekly-parent-digest slot (Mondays 06:00 UTC), so the two never contend.
--
--   select * from cron.job;                                -- find it
--   select * from cron.job_run_details order by start_time desc;  -- how it went
--   select cron.unschedule('sweep-abandoned-checkouts');   -- stop it
--
-- To see what it would do without waiting a week, call it directly inside a
-- transaction and roll back:
--   begin; select internal.sweep_abandoned_checkouts(); rollback;
select cron.schedule(
  'sweep-abandoned-checkouts',
  '40 3 * * 0',
  $$ select internal.sweep_abandoned_checkouts(); $$
);
