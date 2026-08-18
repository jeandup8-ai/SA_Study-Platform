-- Illustrative subscription plans — prices are placeholders, not finalised commercial
-- pricing. They live in the database (subscription_plans), not hard-coded in the
-- frontend, so they can be changed by an admin without a redeploy.
insert into subscription_plans (code, name, max_learners, billing_interval, price_cents, currency, is_active)
values
  ('single_monthly', 'Single Learner', 1, 'monthly', 9900, 'ZAR', true),
  ('family_monthly', 'Family (up to 4)', 4, 'monthly', 19900, 'ZAR', true),
  ('single_annual', 'Single Learner (Annual)', 1, 'annual', 99000, 'ZAR', true),
  ('family_annual', 'Family (up to 4, Annual)', 4, 'annual', 199000, 'ZAR', true)
on conflict (code) do nothing;
