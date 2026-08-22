-- Updates commercial pricing to the platform's actual current model: a
-- single plan at R129/month or R1,099/year, replacing the earlier
-- illustrative 4-tier placeholder pricing from migration 0010. Old plans
-- are deactivated (is_active = false), not deleted, so any historical
-- subscriptions.plan_id reference stays valid.
update subscription_plans
set is_active = false
where code in ('single_monthly', 'family_monthly', 'single_annual', 'family_annual');

insert into subscription_plans (code, name, max_learners, billing_interval, price_cents, currency, is_active)
values
  ('family_monthly_2026', 'Family Plan', 4, 'monthly', 12900, 'ZAR', true),
  ('family_annual_2026', 'Family Plan (Annual)', 4, 'annual', 109900, 'ZAR', true)
on conflict (code) do nothing;
