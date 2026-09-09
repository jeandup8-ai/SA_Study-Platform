-- Extends Scan My Work's topic detection (detect-scan-topic) with a second,
-- narrower AI pass: once a topic is confidently identified, look at the same
-- photo again and surface one short, encouraging observation about what to
-- check -- grounded strictly in that topic's own learning objectives and
-- terminology, exactly like the existing "explain a different way" feature
-- (see tutor_explanations / migration 0030). This table follows that same
-- shape and purpose: an append-only audit log that also serves as the source
-- of truth for the per-learner daily rate limit, so there is only one place
-- that number can drift out of sync.
create table scan_mistake_feedback (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  feedback text, -- null when the model found nothing worth flagging (e.g. work looks correct)
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  created_at timestamptz not null default now()
);

comment on table scan_mistake_feedback is 'Log of AI-generated mistake observations from Scan My Work. Doubles as the source of truth for the daily per-learner rate limit, same pattern as tutor_explanations.';

create index idx_scan_mistake_feedback_learner_created on scan_mistake_feedback(learner_id, created_at);

alter table scan_mistake_feedback enable row level security;

create policy scan_mistake_feedback_owner_select on scan_mistake_feedback for select
  using (
    exists (select 1 from learners l where l.id = scan_mistake_feedback.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
  );
create policy scan_mistake_feedback_owner_insert on scan_mistake_feedback for insert
  with check (
    exists (select 1 from learners l where l.id = scan_mistake_feedback.learner_id and l.parent_id = auth.uid())
  );
-- No update/delete policy: the log is append-only, including for the owning parent.
