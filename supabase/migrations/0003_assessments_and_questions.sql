-- Scalable question bank. Questions are never hard-coded into UI components; every
-- practice/quiz/test screen renders from these tables.

create type question_difficulty as enum ('easy', 'medium', 'hard');
create type question_type as enum ('multiple_choice', 'true_false', 'short_answer', 'numeric');

create table questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_id uuid not null references grades(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  topic_id uuid not null references topics(id) on delete cascade,
  subtopic_id uuid references subtopics(id) on delete set null,
  learning_objective_id uuid references learning_objectives(id) on delete set null,
  language language_code not null default 'en',
  difficulty question_difficulty not null default 'easy',
  question_type question_type not null default 'multiple_choice',
  prompt text not null,
  correct_answer text not null, -- canonical answer (option label for MCQ, value for numeric/short)
  explanation text,
  is_demo_content boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_questions_topic on questions(topic_id);
create index idx_questions_grade_subject on questions(grade_id, subject_id);

create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  sort_order smallint not null default 0
);

create index idx_question_options_question on question_options(question_id);

create type assessment_type as enum ('mini_quiz', 'quiz', 'test', 'mock_exam');

create table assessments (
  id uuid primary key default gen_random_uuid(),
  type assessment_type not null,
  title text not null,
  language language_code not null default 'en',
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_id uuid not null references grades(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  lesson_id uuid references lessons(id) on delete set null,
  is_demo_content boolean not null default true,
  created_at timestamptz not null default now()
);

create table assessment_questions (
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  sort_order smallint not null default 0,
  primary key (assessment_id, question_id)
);

create table assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  assessment_id uuid not null references assessments(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric(5,2),
  total_questions integer not null default 0
);

create index idx_attempts_learner on assessment_attempts(learner_id);

create table assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references assessment_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_id uuid references question_options(id) on delete set null,
  answer_text text,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now()
);

create index idx_answers_attempt on assessment_answers(attempt_id);

-- Exam preparation
create table exam_periods (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references grades(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table exam_readiness (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  readiness_score numeric(5,2) not null default 0 check (readiness_score between 0 and 100),
  strong_topic_ids uuid[] not null default '{}',
  needs_revision_topic_ids uuid[] not null default '{}',
  weak_topic_ids uuid[] not null default '{}',
  recommended_sessions_per_week smallint not null default 3,
  recommended_session_minutes smallint not null default 20,
  updated_at timestamptz not null default now(),
  unique (learner_id, subject_id, term_id)
);

create index idx_exam_readiness_learner on exam_readiness(learner_id);
