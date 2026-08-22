-- Automated curriculum source-validation layer (V2.2 prep). This is
-- deliberately additive and separate from content_workflow_status, which
-- keeps its existing meaning untouched: a human still has to move a record
-- to VERIFIED/PUBLISHED. AUTO_VERIFIED here means "an automated pipeline
-- found strong, reproducible source evidence for this record" — never
-- "a human reviewed this." No existing row's content_workflow_status is
-- changed by this migration.

create type curriculum_validation_status as enum (
  'NOT_VALIDATED',
  'AUTO_VALIDATED',
  'AUTO_VERIFIED',
  'REVIEW_REQUIRED',
  'SOURCE_INCOMPLETE',
  'NON_CURRICULUM',
  'CONFLICTING'
);

create type curriculum_source_completeness as enum (
  'COMPLETE',
  'INCOMPLETE',
  'AMENDMENT_ONLY',
  'UNKNOWN'
);

alter table curriculum_sources
  add column source_status curriculum_source_completeness not null default 'UNKNOWN',
  add column source_scope text;

alter table topics
  add column validation_status curriculum_validation_status not null default 'NOT_VALIDATED',
  add column validation_confidence numeric,
  add column source_coordinates jsonb,
  add column source_text_hash text,
  add column source_snippet text,
  add column validation_method text[],
  add column validation_timestamp timestamptz,
  add column validation_version text,
  add column validation_reason text,
  add column secondary_extraction_match boolean;

alter table assessment_notes
  add column validation_status curriculum_validation_status not null default 'NOT_VALIDATED',
  add column validation_confidence numeric,
  add column source_coordinates jsonb,
  add column source_text_hash text,
  add column source_snippet text,
  add column validation_method text[],
  add column validation_timestamp timestamptz,
  add column validation_version text,
  add column validation_reason text,
  add column secondary_extraction_match boolean;

comment on column topics.validation_status is
  'Machine-computed source-validation outcome (see curriculum-tools/src/validation). Independent of content_workflow_status: AUTO_VERIFIED is not human review and never changes content_workflow_status on its own.';
comment on column topics.source_coordinates is
  'Best-effort bounding box {xMin,xMax,yTop,yBottom} in PDF points for the region this record was extracted from, when the producing detector could compute one. Null when not captured (e.g. records imported before this capability existed and not matched by a later backfill pass).';

-- Known source-completeness facts, established by direct inspection of each
-- PDF during the V2/V2.1 passes (see curriculum/import-log.json for the
-- underlying evidence for every one of these). Not inferred here — restating
-- already-verified findings as queryable metadata.
update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 4-6 Mathematics CAPS document. Genuine topic content present and extracted (content-outline CONTENT-column table).'
where document_id = 'dbe-caps-math-ip';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 4-6 Life Skills CAPS document. Personal & Social Well-being and Visual Arts extracted via a document-specific structural table reader; Physical Education''s layout is not structurally parsed (falls to the generic low-confidence fallback only); Performing Arts yields 0 candidates (safe under-extraction, not a source gap).'
where document_id = 'dbe-caps-lifeskills-ip';

update curriculum_sources set
  source_status = 'AMENDMENT_ONLY',
  source_scope = 'Confirmed a 5-page content-removal amendment/circular, not the full Natural Sciences & Technology CAPS policy document. Contains no topic content by design -- only a Section 4 (Assessment) cognitive-levels verb glossary is genuine content in this file. The full NS&T CAPS document is still required for Grade 4-6 topics in this subject.'
where document_id = 'dbe-caps-nst-ip-amendment';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 4-6 Social Sciences CAPS document. History and Geography grade-column summary tables extracted; one disclosed row-level rendering artifact (a superscript "15th century" ordinal-suffix quirk) affects one History Term 2 row.'
where document_id = 'dbe-caps-socsci-ip';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 7-9 Mathematics CAPS document. Grade 7''s dense CONTENT/CLARIFICATION table (pages 21-29) extracted via a geometry-based table detector.'
where document_id = 'dbe-caps-math-sp';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 7-9 Natural Sciences CAPS document. Grade 7''s Senior Phase section (pages 18-89) is authored in landscape with ~90-degree-rotated text; extraction recovers genuine topics but a disclosed font-run character-split limitation (missing first 1-2 characters on some entries) remains unresolved this pass -- rotated-table records are deliberately excluded from AUTO_VERIFIED regardless of other evidence until that limitation is fixed.'
where document_id = 'dbe-caps-natsci-sp';

update curriculum_sources set
  source_status = 'INCOMPLETE',
  source_scope = 'Confirmed (all 19 pages read directly): this file contains Chapter 4 (Assessment) only. Chapters 1-3, where actual Grade 7-9 Technology curriculum content/topics live, are entirely absent from this file. The complete official CAPS Technology Senior Phase document is required before any Grade 7 Technology topic can be extracted honestly.'
where document_id = 'dbe-caps-tech-sp';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 7-9 Creative Arts CAPS document. Dance, Drama, Music and Visual Arts topics extracted via a topic/time/resource mini-table reader, including a fix for two reversed-column-header Drama pages.'
where document_id = 'dbe-caps-creativearts-sp';

update curriculum_sources set
  source_status = 'COMPLETE',
  source_scope = 'Full Grades 7-9 Human & Social Sciences CAPS document. Grade 7 extracted from a "Term | Grade 7 | Grade 8 | Grade 9" grade-as-column summary table, reading only the Grade 7 column.'
where document_id = 'dbe-caps-humansocsci-sp';
