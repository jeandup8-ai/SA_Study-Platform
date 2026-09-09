-- Gamification: points + badges. Points are earned automatically as a byproduct
-- of the existing quiz/practice flow (see recordQuizResult in
-- src/lib/mastery/engine.ts and the V2 practice-completion bonus in
-- LessonPage.tsx) -- there is no separate "claim" action, matching this app's
-- existing pattern of deriving progress signals from what a learner already
-- does rather than adding a parallel thing to remember to do.
--
-- Points and badges follow the exact ownership/RLS shape already used for
-- learner_progress/study_sessions/mastery in migration 0005: the owning
-- parent can read and insert directly from the browser client (no
-- service-role key involved), ownership re-derived via a join to `learners`,
-- never trusted from a client-supplied column.
--
-- Deliberately no cross-family leaderboard or public profile: the only
-- ranking view this product will ever show is a parent's own children
-- against each other (see ParentDashboardPage), consistent with this
-- session's existing child-safety audit (no public profiles/social
-- features -- see supabase/migrations and the /privacy page).

alter table learners add column total_points integer not null default 0;
comment on column learners.total_points is 'Cached sum of learner_points_ledger.points for this learner, kept in sync by increment_learner_points(). Denormalised for cheap dashboard/leaderboard reads.';

create table learner_points_ledger (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  points integer not null,
  reason text not null, -- 'correct_answer' | 'attempt' | 'practice_completed' (see src/lib/gamification/points.ts)
  reference_id uuid, -- the question_id or lesson_id this award relates to, where applicable; no FK (polymorphic, log-only)
  created_at timestamptz not null default now()
);

comment on table learner_points_ledger is 'Append-only log of every point award. Source of truth for learners.total_points (a cached sum) and for volume-based badge thresholds (e.g. counting reason=correct_answer rows).';

create index idx_points_ledger_learner on learner_points_ledger(learner_id);
create index idx_points_ledger_learner_reason on learner_points_ledger(learner_id, reason);

alter table learner_points_ledger enable row level security;

create policy learner_points_ledger_owner_select on learner_points_ledger for select
  using (
    exists (select 1 from learners l where l.id = learner_points_ledger.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
  );
create policy learner_points_ledger_owner_insert on learner_points_ledger for insert
  with check (
    exists (select 1 from learners l where l.id = learner_points_ledger.learner_id and l.parent_id = auth.uid())
  );
-- No update/delete policy: append-only, same convention as tutor_explanations.

-- Bumps the cached counter after a client has inserted the corresponding
-- ledger rows itself. SECURITY INVOKER (the default) is correct, not
-- DEFINER: this only performs a write that learners_update_own (migration
-- 0005) already permits the calling parent to do directly, so the function
-- adds atomicity (a single round trip, no read-modify-write race between two
-- quiz submissions landing at once) without needing elevated privilege.
create or replace function increment_learner_points(p_learner_id uuid, p_amount integer)
returns void
language sql
as $$
  update learners set total_points = total_points + p_amount where id = p_learner_id;
$$;

create table learner_badges (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  badge_code text not null,
  earned_at timestamptz not null default now(),
  unique (learner_id, badge_code)
);

comment on table learner_badges is 'Earned achievement badges. badge_code matches an entry in the client-side BADGE_CATALOG (src/lib/gamification/badges.ts) -- there is no server-side badge-definition table, since the set of badges is fixed at build time rather than admin-editable content, matching how e.g. learner_avatar is a fixed enum rather than a content table.';

create index idx_learner_badges_learner on learner_badges(learner_id);

alter table learner_badges enable row level security;

create policy learner_badges_owner_select on learner_badges for select
  using (
    exists (select 1 from learners l where l.id = learner_badges.learner_id and (l.parent_id = auth.uid() or internal.is_admin()))
  );
create policy learner_badges_owner_insert on learner_badges for insert
  with check (
    exists (select 1 from learners l where l.id = learner_badges.learner_id and l.parent_id = auth.uid())
  );
-- No update/delete policy: once earned, a badge is never revoked or edited.
