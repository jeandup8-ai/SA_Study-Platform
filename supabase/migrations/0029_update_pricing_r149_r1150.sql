-- Updates commercial pricing from R129/month + R1,099/year (migration 0024) to
-- R149/month + R1,150/year. Same plan rows are updated in place (not
-- deactivated + recreated) since this is a price change on the same
-- commercial offering, not a new plan.
update subscription_plans
set price_cents = 14900
where code = 'family_monthly_2026';

update subscription_plans
set price_cents = 115000
where code = 'family_annual_2026';
