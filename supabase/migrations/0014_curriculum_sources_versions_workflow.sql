-- Curriculum taxonomy expansion, part 2: source documents, versioning, and the
-- content review/publish workflow. This is the backbone of "never let AI or an
-- import silently become authoritative curriculum" — nothing reaches
-- content_workflow_status = 'VERIFIED' or 'PUBLISHED' without a human reviewer,
-- enforced by application logic (the importer never writes those statuses) and
-- documented here; a DB-level constraint isn't practical since the reviewer
-- action itself is a plain UPDATE performed by an authenticated admin.

create type source_verification_status as enum (
  'PENDING',        -- known to exist, not yet downloaded
  'IMPORTED',        -- file downloaded/uploaded, stored, not yet parsed
  'PARSED',          -- text/structure extracted
  'REVIEW_REQUIRED', -- extracted curriculum records exist, awaiting human review
  'VERIFIED',        -- a human confirmed extracted records match the source
  'PUBLISHED',       -- verified records are live to learners
  'ARCHIVED'
);

create type source_document_type as enum (
  'caps', 'atp', 'sba_exemplar', 'ieb_reference', 'index_page', 'other'
);

create table curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  document_id text not null unique, -- stable slug, matches curriculum/sources/manifest.json
  organisation text not null default 'Department of Basic Education (South Africa)',
  title text not null,
  document_type source_document_type not null,
  phase_id uuid references phases(id) on delete set null,
  grade_id uuid references grades(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  academic_year text,
  publication_year smallint,
  version text,
  official_url text,
  local_file_path text, -- path under curriculum/sources/{caps,atp,sba,ieb}/
  checksum text, -- sha256 of the stored file, set on import so re-imports can detect changes
  import_date timestamptz,
  last_verified timestamptz,
  status source_verification_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_curriculum_sources_status on curriculum_sources(status);
create index idx_curriculum_sources_grade_subject on curriculum_sources(grade_id, subject_id);

alter table curriculum_outcomes add constraint curriculum_outcomes_source_fk
  foreign key (source_id) references curriculum_sources(id) on delete set null;

-- Lightweight version ledger: which academic-year version of a curriculum
-- record is current, and what it superseded. Kept generic (entity_type +
-- entity_id) rather than a version column on every table, since only a few
-- entities (curriculum_outcomes, atp_entries, learning_objectives) actually
-- change year to year — most (e.g. a specific lesson) don't need this.
create table curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- e.g. 'curriculum_outcome', 'atp_entry', 'learning_objective'
  entity_id uuid not null,
  academic_year text not null,
  source_id uuid references curriculum_sources(id) on delete set null,
  is_current boolean not null default true,
  supersedes_version_id uuid references curriculum_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, academic_year)
);

create index idx_curriculum_versions_entity on curriculum_versions(entity_type, entity_id);
create index idx_curriculum_versions_current on curriculum_versions(entity_type, entity_id) where is_current;

-- Content workflow status: distinct from source_verification_status above.
-- A *source document* moves PENDING -> ... -> PUBLISHED as a whole; each
-- individual *curriculum record* extracted from it (a topic, objective,
-- question, lesson) carries its own workflow status through review.
create type content_workflow_status as enum (
  'DRAFT', 'AI_GENERATED', 'REVIEW_REQUIRED', 'VERIFIED', 'PUBLISHED', 'ARCHIVED'
);

alter table topics add column content_workflow_status content_workflow_status not null default 'DRAFT';
alter table topics add column source_id uuid references curriculum_sources(id) on delete set null;
alter table topics add column source_page text;
alter table topics add column source_section text;

alter table subtopics add column content_workflow_status content_workflow_status not null default 'DRAFT';

alter table learning_objectives add column content_workflow_status content_workflow_status not null default 'DRAFT';
alter table learning_objectives add column source_id uuid references curriculum_sources(id) on delete set null;
alter table learning_objectives add column source_page text;
alter table learning_objectives add column source_section text;

alter table lessons add column content_workflow_status content_workflow_status not null default 'DRAFT';

alter table questions add column content_workflow_status content_workflow_status not null default 'DRAFT';
alter table questions add column source_id uuid references curriculum_sources(id) on delete set null;

comment on column topics.content_workflow_status is
  'Formal review pipeline for content extracted via the curriculum importer. Distinct from is_demo_content, which marks the original hand-authored placeholder/demo lessons and stays true for those regardless of this column.';

-- CAPS (content requirement) vs ATP (teaching sequence/pacing) must not be
-- merged. A topic already represents the CAPS requirement; an atp_entry
-- represents WHEN in the year a topic is taught, for a specific academic year,
-- and can differ year to year without changing the underlying CAPS topic.
create table atp_entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  academic_year text not null,
  week_start smallint,
  week_end smallint,
  sequence_order smallint not null default 0,
  source_id uuid references curriculum_sources(id) on delete set null,
  content_workflow_status content_workflow_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  unique (topic_id, term_id, academic_year)
);

create index idx_atp_entries_term_year on atp_entries(term_id, academic_year);

comment on table atp_entries is
  'Annual Teaching Plan sequencing — WHEN a CAPS topic is taught in a given academic year. The topic itself (the CAPS requirement) lives in `topics` and does not change year to year the way this pacing can.';
