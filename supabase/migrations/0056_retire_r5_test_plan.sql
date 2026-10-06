-- Record and retire the R5 live-payment test plan.
--
-- This plan was created directly against production on 2026-10-06 to prove
-- the annual payment path on *live* PayFast rather than the sandbox, which
-- had become unreachable. R5 is the smallest amount worth risking to
-- exercise a real card, a real signature and a real ITN. It did its job:
-- the resulting transaction came back amount_gross 5, signature_valid true,
-- server_validated true, processed true, recurring token stored, status
-- active, 365 days granted -- the first end-to-end proof that frequency=6
-- works against the live merchant.
--
-- It was never in a migration, so the schema history could not account for
-- a plan row that exists in production. This migration states it, then
-- retires it, so the two agree.
--
-- DEACTIVATED, NOT DELETED. One real subscription points at this plan --
-- the R5 payment itself, active until 2027-10-06. Deleting the row would
-- break that subscription's join to its plan and destroy the evidence the
-- test was run for. Deactivating hides it from every pricing surface
-- (all three filter on is_active) and makes payfast-checkout refuse it with
-- plan_not_found, while the subscription keeps resolving its seats and its
-- entitlement exactly as before.

insert into public.subscription_plans
  (code, name, max_learners, billing_interval, price_cents, currency, is_active)
values
  ('tmp_annual_test', 'TEST — do not buy', 1, 'annual', 500, 'ZAR', false)
on conflict (code) do update
  set is_active = false;

-- Belt and braces: whatever the row's history, it is off now.
update public.subscription_plans
set is_active = false
where code = 'tmp_annual_test';
