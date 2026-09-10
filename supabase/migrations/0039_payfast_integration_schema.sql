-- Real payment integration support (PayFast). Three things:
--
-- 1. subscriptions_owner_update (migration 0004/0005) let a signed-in parent
--    UPDATE any column on their own subscriptions row, including status --
--    meaning a parent could set their own subscription to 'active' via the
--    client with no payment at all. A trigger now blocks every
--    billing-relevant column from changing unless the request comes from the
--    service-role client (used only by the payfast-itn and payfast-cancel
--    edge functions). Parents can still UPDATE their own row for anything
--    else (e.g. cancel_requested_at below).
--
-- 2. cancel_requested_at: lets the self-service "Cancel subscription" button
--    record intent immediately, independent of whether the best-effort
--    PayFast-side cancel API call succeeds.
--
-- 3. payment_events: append-only audit + idempotency log for PayFast ITN
--    (Instant Transaction Notification) callbacks. The unique constraint on
--    (provider, provider_event_id) is what stops the same PayFast payment
--    notification from being applied twice if PayFast retries delivery.

alter table subscriptions add column if not exists cancel_requested_at timestamptz;

create or replace function internal.protect_subscription_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  then
    raise exception 'Only the payment system can change subscription billing fields';
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_protect_billing_fields on subscriptions;
create trigger subscriptions_protect_billing_fields
before update on subscriptions
for each row execute function internal.protect_subscription_billing_fields();

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  subscription_id uuid references subscriptions(id),
  payment_status text,
  amount_gross numeric,
  raw_payload jsonb not null,
  signature_valid boolean not null,
  server_validated boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table payment_events enable row level security;

create policy payment_events_admin_read on payment_events
  for select using (internal.is_admin());
