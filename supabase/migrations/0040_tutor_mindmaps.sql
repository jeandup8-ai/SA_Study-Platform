-- "Mind map" AI tutor action: a simplified visual mind map (central topic +
-- a handful of branches, each with a few short child points) for the topic
-- the learner is currently on, grounded strictly in that topic's own
-- curriculum content -- same safety posture as tutor_explanations (migration
-- 0030): no free-text input from the child, nothing outside this topic's
-- own reviewed content. This table is both the append-only audit log and
-- the source of truth for its own, independent per-learner daily rate
-- limit -- kept separate from tutor_explanations' limit so the two AI
-- actions don't silently share (and exhaust) each other's budget.
create table tutor_mindmaps (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  mindmap jsonb not null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

comment on table tutor_mindmaps is 'Log of AI-generated topic mind maps. Doubles as the source of truth for the daily per-learner rate limit.';

create index idx_tutor_mindmaps_learner_created on tutor_mindmaps(learner_id, created_at);

alter table tutor_mindmaps enable row level security;

create policy tutor_mindmaps_owner_select on tutor_mindmaps for select
  using (
    exists (select 1 from learners l where l.id = tutor_mindmaps.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
  );
create policy tutor_mindmaps_owner_insert on tutor_mindmaps for insert
  with check (
    exists (select 1 from learners l where l.id = tutor_mindmaps.learner_id and l.parent_id = auth.uid())
  );
-- No update/delete policy: the log is append-only, including for the owning parent.
