-- "Explain a different way" feature: an LLM-generated alternate explanation of a
-- topic the learner is stuck on, grounded strictly in this topic's own curriculum
-- content (learning objectives, verified terminology, existing lesson content) via
-- the tutor context already built in src/lib/tutor/context.ts. Never a free-text
-- chat surface for the child -- the client only ever sends a topic_id, never
-- arbitrary text, so there is no prompt-injection surface from the child side.
--
-- This table is both the append-only audit log (what was generated, for a parent
-- or admin to review later) and the source of truth for the per-learner daily rate
-- limit -- the Edge Function counts today's rows for a learner rather than
-- maintaining a separate counter, since the log needs to exist anyway and two
-- sources of truth for the same limit would drift.
create table tutor_explanations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  framing text not null,
  explanation jsonb not null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

comment on table tutor_explanations is 'Log of AI-generated alternate explanations ("explain a different way"). Doubles as the source of truth for the daily per-learner rate limit.';
comment on column tutor_explanations.framing is 'The explanation angle used (e.g. analogy, story, steps, visual) -- recorded so the next request for this learner+topic can pick a framing not already tried.';

create index idx_tutor_explanations_learner_created on tutor_explanations(learner_id, created_at);

alter table tutor_explanations enable row level security;

create policy tutor_explanations_owner_select on tutor_explanations for select
  using (
    exists (select 1 from learners l where l.id = tutor_explanations.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
  );
create policy tutor_explanations_owner_insert on tutor_explanations for insert
  with check (
    exists (select 1 from learners l where l.id = tutor_explanations.learner_id and l.parent_id = auth.uid())
  );
-- No update/delete policy: the log is append-only, including for the owning parent.
