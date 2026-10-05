-- Two tiers, each monthly and annual.
--
--   Solo    1 child      R149/month    R1,199/year
--   Family  up to 4      R419/month    R3,349/year
--
-- WHY THE SHAPE CHANGED. Until now a single Family Plan gave up to four
-- children for R149, so a one-child household subsidised a four-child one
-- while the per-learner costs (AI explanations, scan uploads, storage) ran
-- the other way. Splitting the tier puts price and cost on the same side.
-- Solo keeps today's price exactly, so the one-child case sees no increase;
-- the four-child case is where the rise lands.
--
-- WHY NEW ROWS RATHER THAN EDITING THE OLD ONES. `family_monthly_2026` and
-- `family_annual_2026` are referenced by ten existing subscriptions,
-- including the four sandbox payments from 2026-09-11. Repricing those rows
-- in place would rewrite what those customers bought -- a R149 four-child
-- plan would retroactively read as a R419 one, and the sandbox evidence
-- would stop matching the amounts PayFast actually processed. So they are
-- deactivated, not changed: the history stays true, and nothing renders
-- them because every pricing surface filters on is_active.
--
-- Deactivated rather than deleted also means the seat trigger still
-- resolves them. A parent whose paid period has not ended keeps the four
-- seats they paid for, because internal.enforce_learner_limit() joins to
-- subscription_plans without caring whether the plan is still on sale.
--
-- The four older dormant plans (single_monthly, single_annual,
-- family_monthly, family_annual) are deliberately untouched.

-- Retire the flat family pricing. Nothing is deleted.
update public.subscription_plans
set is_active = false
where code in ('family_monthly_2026', 'family_annual_2026');

insert into public.subscription_plans (code, name, max_learners, billing_interval, price_cents, currency, is_active)
values
  ('solo_monthly_2026',   'Solo',            1, 'monthly', 14900,  'ZAR', true),
  ('solo_annual_2026',    'Solo (Annual)',   1, 'annual',  119900, 'ZAR', true),
  ('family_monthly_v2_2026', 'Family',       4, 'monthly', 41900,  'ZAR', true),
  ('family_annual_v2_2026',  'Family (Annual)', 4, 'annual', 334900, 'ZAR', true)
on conflict (code) do update
  set name = excluded.name,
      max_learners = excluded.max_learners,
      billing_interval = excluded.billing_interval,
      price_cents = excluded.price_cents,
      is_active = excluded.is_active;

-- Annual is priced at the ratio the product already used (R1,199 against
-- R149 monthly is 8.05 months), carried across to the Family tier:
--   Solo    R149 x 12 = R1,788 -> R1,199 saves R589
--   Family  R419 x 12 = R5,028 -> R3,349 saves R1,679
-- The pricing page computes that saving from these numbers rather than
-- storing it, so nothing else needs to change.
