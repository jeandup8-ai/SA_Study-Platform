-- Daily practice target: competitors (e.g. Gamechanger AI Tutor) advertise
-- a "daily targets met" indicator on their parent dashboard. We already log
-- every graded answer and completion bonus in learner_points_ledger (0036),
-- so "today's activity count" is a read against existing data -- this column
-- is the only new state needed, a parent-configurable goal per learner.
-- Uses learners_update_own (0005), already unrestricted per-column, so no
-- new RLS policy is required.
alter table learners
  add column daily_practice_target integer not null default 5
  check (daily_practice_target >= 1);
