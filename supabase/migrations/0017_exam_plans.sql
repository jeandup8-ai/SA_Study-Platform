-- Structured exam/revision plans, generated from exam_readiness. Kept as a
-- small structured table (not just derived on the fly) so a plan a learner is
-- actively working through stays stable even as their mastery scores keep
-- moving underneath it, and so a parent can see what was recommended and when.

create table exam_plans (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  generated_at timestamptz not null default now(),
  based_on_readiness_score numeric(5,2),
  recommended_sessions_per_week smallint not null default 3,
  recommended_session_minutes smallint not null default 20,
  -- Ordered list of {topic_id, reason, priority} — 'reason' is one of
  -- 'weak_area' | 'needs_revision' | 'prerequisite' | 'spaced_revision' | 'upcoming_assessment'.
  plan_items jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_exam_plans_learner on exam_plans(learner_id);

alter table exam_plans enable row level security;
create policy exam_plans_owner_select on exam_plans for select
  using (exists (select 1 from learners l where l.id = exam_plans.learner_id and (l.parent_id = auth.uid() or is_admin())));
create policy exam_plans_owner_insert on exam_plans for insert
  with check (exists (select 1 from learners l where l.id = exam_plans.learner_id and l.parent_id = auth.uid()));
create policy exam_plans_owner_update on exam_plans for update
  using (exists (select 1 from learners l where l.id = exam_plans.learner_id and l.parent_id = auth.uid()))
  with check (exists (select 1 from learners l where l.id = exam_plans.learner_id and l.parent_id = auth.uid()));
