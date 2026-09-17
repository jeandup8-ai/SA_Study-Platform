-- Free, ungated CAPS practice tests -- the public top-of-funnel.
--
-- These are deliberately NOT the raw `topics` rows: those came out of the CAPS
-- PDF extraction and carry artefacts ("1.1. Whole numbers DIVISION") that must
-- never appear in a public URL or page title. A practice test is a curated,
-- bilingual wrapper with its own editorial title, slug and question order, and
-- it links back to the curriculum topic so a visitor who converts lands on the
-- matching lesson.

create table public.practice_tests (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  slug text not null,
  title_en text not null,
  title_af text,
  summary_en text,
  summary_af text,
  sort_order smallint not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index practice_tests_grade_subject_slug_key
  on public.practice_tests (grade_id, subject_id, slug);
create index practice_tests_published_idx
  on public.practice_tests (grade_id, subject_id, sort_order) where is_published;

create table public.practice_test_questions (
  practice_test_id uuid not null references public.practice_tests (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  sort_order smallint not null default 0,
  primary key (practice_test_id, question_id)
);

create index practice_test_questions_order_idx
  on public.practice_test_questions (practice_test_id, sort_order);

alter table public.practice_tests enable row level security;
alter table public.practice_test_questions enable row level security;

-- Anonymous visitors are the whole point of this table, but only published rows.
create policy practice_tests_public_read on public.practice_tests
  for select using (is_published or internal.is_admin());
create policy practice_tests_admin_insert on public.practice_tests
  for insert with check (internal.is_admin());
create policy practice_tests_admin_update on public.practice_tests
  for update using (internal.is_admin());
create policy practice_tests_admin_delete on public.practice_tests
  for delete using (internal.is_admin());

create policy practice_test_questions_public_read on public.practice_test_questions
  for select using (
    exists (
      select 1 from public.practice_tests pt
      where pt.id = practice_test_id and (pt.is_published or internal.is_admin())
    )
  );
create policy practice_test_questions_admin_insert on public.practice_test_questions
  for insert with check (internal.is_admin());
create policy practice_test_questions_admin_update on public.practice_test_questions
  for update using (internal.is_admin());
create policy practice_test_questions_admin_delete on public.practice_test_questions
  for delete using (internal.is_admin());
