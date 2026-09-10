-- Corrects the Family Plan annual price. Monthly (R149) was already right;
-- annual had been set to R1,150 in an earlier pricing pass but the actual
-- agreed price is R1,199/yr, accounting for per-topic AI image-generation
-- costs. See migration 0010 (initial pricing) and the 20260902175357
-- update_pricing_r149_r1150 migration this corrects.
update subscription_plans set price_cents = 119900 where code = 'family_annual_2026';
