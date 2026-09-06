create table learner_topic_baselines (
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  baseline_mastery numeric(5,2) not null check (baseline_mastery between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (learner_id, topic_id)
);

alter table learner_topic_baselines enable row level security;

create policy learner_topic_baselines_owner_select on learner_topic_baselines for select using (
  exists (select 1 from learners l where l.id = learner_topic_baselines.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
);

create policy learner_topic_baselines_owner_insert on learner_topic_baselines for insert with check (
  exists (select 1 from learners l where l.id = learner_topic_baselines.learner_id and l.parent_id = auth.uid())
);

create policy learner_topic_baselines_owner_update on learner_topic_baselines for update using (
  exists (select 1 from learners l where l.id = learner_topic_baselines.learner_id and l.parent_id = auth.uid())
) with check (
  exists (select 1 from learners l where l.id = learner_topic_baselines.learner_id and l.parent_id = auth.uid())
);

create policy learner_topic_baselines_owner_delete on learner_topic_baselines for delete using (
  exists (select 1 from learners l where l.id = learner_topic_baselines.learner_id and l.parent_id = auth.uid())
);
