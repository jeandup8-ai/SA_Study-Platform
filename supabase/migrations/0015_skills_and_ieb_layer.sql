-- Skill tagging + IEB enrichment layer. IEB is explicitly NOT a separate
-- curriculum here (see spec) — it is an assessment-style overlay on top of the
-- same CAPS topics/objectives, emphasising application/reasoning/critical
-- thinking skills. A learner's "IEB readiness" is computed from their mastery
-- of those specific skills, kept separate from their overall CAPS mastery score
-- so a parent can see "knows the content (CAPS) vs can apply it under IEB-style
-- conditions (skills)" as two distinct numbers.

create table skills (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'knowledge', 'understanding', 'application', ...
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Which skills a learning objective or topic exercises (used for coverage
-- reporting and for selecting IEB-style enrichment questions).
create table curriculum_skills (
  learning_objective_id uuid references learning_objectives(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  weight numeric(3,2) not null default 1.0 check (weight between 0 and 1),
  check (learning_objective_id is not null or topic_id is not null)
);

create index idx_curriculum_skills_objective on curriculum_skills(learning_objective_id);
create index idx_curriculum_skills_topic on curriculum_skills(topic_id);

-- Which skills a given question exercises, and how strongly.
create table question_skills (
  question_id uuid not null references questions(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  weight numeric(3,2) not null default 1.0 check (weight between 0 and 1),
  primary key (question_id, skill_id)
);

-- 'ieb_enrichment' style questions deliberately favour application/reasoning/
-- critical-thinking/unfamiliar-context framing. They are still ORIGINAL
-- platform-authored questions, never claimed to be real IEB exam content —
-- see the check constraint tying that claim to is_demo_content/workflow status
-- rather than any "this is an official IEB question" flag, because no such
-- flag should ever exist.
create type assessment_style as enum ('caps_standard', 'ieb_enrichment');

alter table questions add column assessment_style assessment_style not null default 'caps_standard';
alter table assessments add column assessment_style assessment_style not null default 'caps_standard';

-- Per-learner, per-skill mastery (optionally scoped to a topic). This is what
-- both "skill mastery" (spec section 27) and "IEB application score" (section
-- 17) are computed from — the IEB application score is simply this table
-- filtered to skill_id = the 'application' skill (or a small weighted set of
-- IEB-emphasised skills), aggregated across a subject/topic.
create table learner_skill_mastery (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  topic_id uuid references topics(id) on delete cascade, -- null = subject/overall aggregate
  subject_id uuid references subjects(id) on delete cascade,
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  attempts_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (learner_id, skill_id, topic_id, subject_id)
);

create index idx_learner_skill_mastery_learner on learner_skill_mastery(learner_id);

alter table learner_skill_mastery enable row level security;
create policy learner_skill_mastery_owner_select on learner_skill_mastery for select
  using (exists (select 1 from learners l where l.id = learner_skill_mastery.learner_id and (l.parent_id = auth.uid() or is_admin())));
create policy learner_skill_mastery_owner_insert on learner_skill_mastery for insert
  with check (exists (select 1 from learners l where l.id = learner_skill_mastery.learner_id and l.parent_id = auth.uid()));
create policy learner_skill_mastery_owner_update on learner_skill_mastery for update
  using (exists (select 1 from learners l where l.id = learner_skill_mastery.learner_id and l.parent_id = auth.uid()))
  with check (exists (select 1 from learners l where l.id = learner_skill_mastery.learner_id and l.parent_id = auth.uid()));

alter table skills enable row level security;
create policy skills_public_read on skills for select using (true);
create policy skills_admin_write_insert on skills for insert with check (is_admin());
create policy skills_admin_write_update on skills for update using (is_admin()) with check (is_admin());

alter table curriculum_skills enable row level security;
create policy curriculum_skills_public_read on curriculum_skills for select using (true);
create policy curriculum_skills_admin_write_insert on curriculum_skills for insert with check (is_admin());
create policy curriculum_skills_admin_write_delete on curriculum_skills for delete using (is_admin());

alter table question_skills enable row level security;
create policy question_skills_public_read on question_skills for select using (true);
create policy question_skills_admin_write_insert on question_skills for insert with check (is_admin());
create policy question_skills_admin_write_delete on question_skills for delete using (is_admin());
