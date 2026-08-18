-- Parent-owned account model. Learners have no separate login credentials (POPIA data
-- minimisation + child safety: nothing for a child to leak, no direct child auth surface).
-- Parents authenticate via Supabase Auth (auth.users); this table extends that identity.

create table parents (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  preferred_language language_code not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table parents is 'Extends auth.users for the account-owning parent. No physical address is collected (see spec section 12).';

create type learner_avatar as enum (
  'fox', 'owl', 'lion', 'elephant', 'zebra', 'meerkat', 'tortoise', 'eagle'
);

create table learners (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  display_name text not null,
  avatar learner_avatar not null default 'fox',
  curriculum_id uuid not null references curricula(id),
  grade_id uuid not null references grades(id),
  preferred_language language_code not null default 'en',
  birth_year smallint, -- year only; full DOB is not required for the product to function
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table learners is 'A child profile under a parent account. Minimal PII by design: no address, no contact details, no login.';

create index idx_learners_parent on learners(parent_id);

create type progress_status as enum ('not_started', 'in_progress', 'completed');

create table learner_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status progress_status not null default 'not_started',
  score numeric(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, lesson_id)
);

create index idx_learner_progress_learner on learner_progress(learner_id);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  subject_id uuid references subjects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  lesson_id uuid references lessons(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer
);

create index idx_study_sessions_learner on study_sessions(learner_id);

-- Mastery is per learner per topic. The adaptive engine (future) writes here; for now
-- it is derived from quiz/assessment results by a simple weighted-average function.
create table mastery (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  attempts_count integer not null default 0,
  last_practised_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, topic_id)
);

create index idx_mastery_learner on mastery(learner_id);

-- Weakness signals: structured hints about *why* a learner is struggling (e.g. "place_value"
-- underlying a multiplication weakness), rather than only a raw score. Populated by the
-- mastery engine as it analyses wrong-answer patterns.
create table mastery_weakness_signals (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  signal_code text not null, -- e.g. 'place_value', 'reading_comprehension_inference'
  description text not null,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create index idx_weakness_learner_topic on mastery_weakness_signals(learner_id, topic_id);
