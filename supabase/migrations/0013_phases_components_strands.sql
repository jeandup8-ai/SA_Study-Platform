-- Curriculum taxonomy expansion, part 1: phases, subject components, strands,
-- curriculum outcomes. These are official CAPS organisational categories
-- (public taxonomy — "Life Skills contains Creative Arts / Physical Education /
-- Personal and Social Well-being" is how DBE itself structures the subject, not
-- invented content) so it is safe to seed their NAMES now; no topic, objective,
-- or lesson content is implied or seeded by this migration.

-- A phase groups grades (Foundation R-3, Intermediate 4-6, Senior 7-9, FET 10-12).
create table phases (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references curricula(id) on delete cascade,
  code text not null, -- 'FOUNDATION', 'INTERMEDIATE', 'SENIOR', 'FET'
  name text not null,
  grade_range_start smallint not null,
  grade_range_end smallint not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (curriculum_id, code)
);

alter table grades add column phase_id uuid references phases(id) on delete set null;

-- Some subjects have official internal components that must not be flattened —
-- e.g. Life Skills = Creative Arts + Physical Education + Personal and Social
-- Well-being (Intermediate Phase); Creative Arts (Senior Phase) = Dance + Drama
-- + Music + Visual Arts. A component is optional: most subjects have none.
create table subject_components (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, code)
);

-- A strand is the CAPS-level grouping above topic within a subject for a phase
-- (e.g. Mathematics: "Numbers, Operations and Relationships", "Space and Shape").
-- Optional — not every subject/phase uses the term, so topics may reference
-- strand_id = null.
create table strands (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  code text not null,
  name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, code)
);

alter table topics add column strand_id uuid references strands(id) on delete set null;
alter table topics add column subject_component_id uuid references subject_components(id) on delete set null;

-- Curriculum outcomes are the subject/phase-level "Specific Aims" CAPS defines
-- (broader than a single lesson's learning_objective, which stays lesson-scoped).
create table curriculum_outcomes (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  code text,
  description text not null,
  source_id uuid, -- FK added once curriculum_sources exists (migration 0014)
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_subject_components_subject on subject_components(subject_id);
create index idx_strands_subject on strands(subject_id);
create index idx_topics_strand on topics(strand_id);
create index idx_curriculum_outcomes_subject on curriculum_outcomes(subject_id);
