-- V2 curriculum extraction pipeline (see curriculum-tools' importSource.ts):
-- source-traceability columns the spec requires on every extracted record
-- (extraction_method, confidence_score, import_version), plus a place to
-- keep assessment-programme/appendix text the importer now recognises and
-- diverts, so it's stored rather than silently discarded but never
-- surfaces as if it were a curriculum topic a learner should study.

alter table topics add column extraction_method text;
alter table topics add column confidence_score numeric(3, 2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));
alter table topics add column import_version text;

comment on column topics.extraction_method is
  'How this record was produced: "pdf_table" (a detected table cell) or "pdf_text" (a heading). Null for hand-authored/demo rows the importer never touched.';
comment on column topics.confidence_score is
  'Heuristic extraction confidence in [0, 1], not a correctness guarantee — every row still requires human review regardless of this value (see content_workflow_status).';
comment on column topics.import_version is
  'Tags which reprocessing pass produced this row (e.g. "2026-08-21-v2"), so a later pass can identify and replace exactly what a prior version wrote instead of patching rows in place.';

create table assessment_notes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  grade_id uuid references grades(id) on delete set null,
  term_id uuid references terms(id) on delete set null,
  category text not null check (category in ('ASSESSMENT_GUIDANCE', 'ASSESSMENT_APPENDIX')),
  text text not null,
  content_workflow_status content_workflow_status not null default 'REVIEW_REQUIRED',
  source_id uuid references curriculum_sources(id) on delete set null,
  source_page text,
  source_section text,
  extraction_method text,
  confidence_score numeric(3, 2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  import_version text,
  created_at timestamptz not null default now()
);

create index idx_assessment_notes_subject_grade on assessment_notes(subject_id, grade_id);
create index idx_assessment_notes_source on assessment_notes(source_id);

comment on table assessment_notes is
  'Assessment-programme/appendix text the curriculum importer classified as NOT a curriculum topic (see Priority 4''s classification layer in curriculumDetectors.ts) — kept as real source evidence, never exposed to learners as something to study, and never inserted into topics. Distinct from a rejected/discarded record: this table exists specifically so genuine assessment guidance is retrievable, not deleted.';

alter table assessment_notes enable row level security;
create policy assessment_notes_public_read on assessment_notes for select using (true);
create policy assessment_notes_admin_write_insert on assessment_notes for insert with check (is_admin());
create policy assessment_notes_admin_write_update on assessment_notes for update using (is_admin()) with check (is_admin());
create policy assessment_notes_admin_write_delete on assessment_notes for delete using (is_admin());
