-- Curriculum architecture: Curriculum -> Grade -> Term -> Subject -> Topic -> Subtopic -> Lesson
-- Designed to support CAPS now and IEB / other curricula, and Grade 4-7 now and 8-12 later,
-- without structural changes: grade_number is unconstrained beyond a sane range, curriculum_id
-- scopes everything, and subjects/topics are linked to grades via a join table (not hard-coded).

create extension if not exists "pgcrypto";

-- All 11 South African official languages (BCP-47-ish short codes), plus room for future locales.
create type language_code as enum (
  'en', -- English
  'af', -- Afrikaans
  'zu', -- isiZulu
  'xh', -- isiXhosa
  'nr', -- isiNdebele
  'nso', -- Sepedi
  'st', -- Sesotho
  'tn', -- Setswana
  'ss', -- siSwati
  've', -- Tshivenda
  'ts'  -- Xitsonga
);

create type media_type as enum (
  'svg_animation',
  'interactive_demo',
  'own_video',
  'external_video',
  'youtube_embed',
  'audio_narration',
  'image',
  'diagram'
);

create type media_approval_status as enum ('pending', 'approved', 'rejected');

create type lesson_section_type as enum (
  'what_are_we_learning',
  'simple_explanation',
  'visual_explanation',
  'example',
  'try_it_yourself',
  'practice_questions',
  'mini_quiz',
  'what_did_you_learn',
  'mastery_result',
  'next_step'
);

create table curricula (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- e.g. 'CAPS', 'IEB'
  name text not null,
  country text not null default 'ZA',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table curricula is 'Top-level curriculum framework, e.g. CAPS. Enables adding IEB etc. later.';

create table grades (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  grade_number smallint not null check (grade_number between 1 and 12),
  name text not null, -- e.g. 'Grade 5'
  is_launched boolean not null default false, -- true for Grade 4-7 at launch
  created_at timestamptz not null default now(),
  unique (curriculum_id, grade_number)
);

create table terms (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references grades(id) on delete cascade,
  term_number smallint not null check (term_number between 1 and 4),
  name text not null, -- e.g. 'Term 1'
  created_at timestamptz not null default now(),
  unique (grade_id, term_number)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  code text not null, -- e.g. 'MATH', 'ENG_HL', 'AFR_FAL'
  name text not null,
  icon_key text, -- maps to a frontend icon component, not a stored image
  color_key text, -- design token, e.g. 'blue'
  created_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

-- Which subjects apply to which grade (subjects vary by phase, e.g. Life Skills vs Life Orientation).
create table grade_subjects (
  grade_id uuid not null references grades(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  sort_order smallint not null default 0,
  primary key (grade_id, subject_id)
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_id uuid not null references grades(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  code text not null,
  name text not null,
  description text,
  sort_order smallint not null default 0,
  is_demo_content boolean not null default true, -- false once verified against official CAPS docs
  created_at timestamptz not null default now(),
  unique (subject_id, grade_id, code)
);

create table subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  name text not null,
  description text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table learning_objectives (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  subtopic_id uuid references subtopics(id) on delete cascade,
  language language_code not null default 'en',
  description text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  subtopic_id uuid references subtopics(id) on delete cascade,
  slug text not null,
  language language_code not null default 'en',
  title text not null,
  estimated_minutes smallint not null default 10,
  sort_order smallint not null default 0,
  is_demo_content boolean not null default true,
  created_at timestamptz not null default now(),
  unique (topic_id, slug, language)
);

create table lesson_content (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  section_type lesson_section_type not null,
  language language_code not null default 'en',
  heading text,
  body_markdown text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Generic media model: never assumes a single video-generation provider.
create table media (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  media_type media_type not null,
  provider text not null default 'internal', -- e.g. 'internal', 'youtube', 'vendor_x'
  url text,
  embed_url text,
  language language_code not null default 'en',
  duration_seconds integer,
  grade_id uuid references grades(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  approval_status media_approval_status not null default 'pending',
  age_rating text not null default 'all_ages',
  source text, -- curated catalogue reference, never arbitrary user-submitted content
  license_status text,
  created_at timestamptz not null default now(),
  constraint media_approved_requires_url check (
    approval_status <> 'approved' or url is not null or embed_url is not null
  )
);

comment on table media is 'Lesson media catalogue. External videos must be pre-approved rows here; the app must never expose unrestricted external video search to children.';

create index idx_topics_subject_grade on topics(subject_id, grade_id);
create index idx_lessons_topic on lessons(topic_id);
create index idx_lesson_content_lesson on lesson_content(lesson_id);
create index idx_media_lesson on media(lesson_id);
