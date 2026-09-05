-- Lets a parent set a starting mastery percentage per subject per learner --
-- e.g. "she was already at about 70% in Maths last semester" -- so a new
-- profile doesn't show a misleading 0% before any real activity exists in
-- the app. fetchSubjectMasterySummary (src/lib/curriculum/dashboard.ts)
-- uses this only as a placeholder: the moment a learner has a real mastery
-- row for any topic in that subject, the genuine computed average takes
-- over completely and this baseline stops being read for that subject.
create table learner_subject_baselines (
  learner_id uuid not null references learners(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  baseline_mastery numeric(5,2) not null check (baseline_mastery between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (learner_id, subject_id)
);

alter table learner_subject_baselines enable row level security;

create policy learner_subject_baselines_owner_select on learner_subject_baselines for select using (
  exists (select 1 from learners l where l.id = learner_subject_baselines.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
);
create policy learner_subject_baselines_owner_insert on learner_subject_baselines for insert with check (
  exists (select 1 from learners l where l.id = learner_subject_baselines.learner_id and l.parent_id = auth.uid())
);
create policy learner_subject_baselines_owner_update on learner_subject_baselines for update using (
  exists (select 1 from learners l where l.id = learner_subject_baselines.learner_id and l.parent_id = auth.uid())
) with check (
  exists (select 1 from learners l where l.id = learner_subject_baselines.learner_id and l.parent_id = auth.uid())
);
create policy learner_subject_baselines_owner_delete on learner_subject_baselines for delete using (
  exists (select 1 from learners l where l.id = learner_subject_baselines.learner_id and l.parent_id = auth.uid())
);
