-- Terminology database + translation verification. Subject-specific vocabulary
-- (especially Maths/Science/Tech/Social Sciences terms) needs deliberate,
-- reviewed translation — generic machine translation gets technical terms
-- wrong often enough that this platform must never present one as verified
-- without a human confirming it.

create table terminology (
  id uuid primary key default gen_random_uuid(),
  term text not null, -- canonical English term
  language language_code not null,
  subject_id uuid references subjects(id) on delete cascade,
  grade_id uuid references grades(id) on delete set null,
  definition text,
  translation text, -- the term itself in `language`; for language='en' this equals `term`
  verified boolean not null default false,
  reviewer_id uuid references admins(id) on delete set null,
  source_id uuid references curriculum_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term, language, subject_id)
);

create index idx_terminology_subject_language on terminology(subject_id, language);

alter table terminology enable row level security;
create policy terminology_public_read on terminology for select using (true);
create policy terminology_admin_write_insert on terminology for insert with check (is_admin());
create policy terminology_admin_write_update on terminology for update using (is_admin()) with check (is_admin());
create policy terminology_admin_write_delete on terminology for delete using (is_admin());

-- Translation status on the content tables that actually hold per-language
-- copy today. Each language is its own row (see language_code columns already
-- on lessons/lesson_content/questions) rather than a canonical+variant model;
-- this status makes clear which of those rows are trustworthy.
create type translation_status as enum ('original', 'machine_translated', 'human_reviewed', 'verified');

alter table lessons add column translation_status translation_status not null default 'original';
alter table lesson_content add column translation_status translation_status not null default 'original';
alter table questions add column translation_status translation_status not null default 'original';

comment on column lessons.translation_status is
  'original = authored directly in this language. machine_translated content must never be shown as translation_status=verified until a human reviewer checks it — see spec section 6/23.';
