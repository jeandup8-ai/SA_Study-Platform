-- V2.3 bilingual lesson-blueprint content columns.
--
-- Deliberate departure from the "one row per language" model used elsewhere on
-- this table (lessons.language / lesson_content.language, see
-- 0016_terminology_and_translation_status.sql): V2.3 content is generated and
-- reviewed as one bilingual record per topic (see
-- curriculum/generated-lessons/lessons-full-v2.3.jsonl), so these columns hold
-- both languages side by side on a single row rather than splitting into a
-- second language='af' row. Populate them on the language='en' lessons row for
-- a topic; do not duplicate onto a separate 'af' row.
alter table lessons add column if not exists narration_script text;
alter table lessons add column if not exists afrikaans_narration_script text;
alter table lessons add column if not exists visual_storyboard jsonb;
alter table lessons add column if not exists afrikaans_visual_storyboard jsonb;
alter table lessons add column if not exists worked_example jsonb;
alter table lessons add column if not exists afrikaans_worked_example jsonb;
alter table lessons add column if not exists practice_questions jsonb;
alter table lessons add column if not exists afrikaans_practice_questions jsonb;
alter table lessons add column if not exists source_trace jsonb;
alter table lessons add column if not exists reviewed_at timestamptz;
alter table lessons add column if not exists reviewed_by uuid references auth.users(id);

comment on column lessons.narration_script is
  'V2.3: full English video-narration script for this lesson blueprint.';
comment on column lessons.afrikaans_narration_script is
  'V2.3: Afrikaans counterpart. See translation_status for review state.';
comment on column lessons.source_trace is
  'V2.3: grounding metadata (source PDF page, generation batch, etc.) for auditability.';
comment on column lessons.reviewed_by is
  'Admin (auth.users.id, matches admins.id) who most recently human-reviewed this lesson''s content.';

-- lessons.translation_status already exists (0016_terminology_and_translation_status.sql)
-- as a NOT NULL enum, default 'original'. The plain-TEXT translation_status column
-- originally requested here is skipped: the column already exists with a different
-- type, so ADD COLUMN IF NOT EXISTS would silently no-op, and its intended value
-- ('MACHINE_TRANSLATED_AI_REVIEWED') isn't valid for the existing enum anyway.
-- Extending the enum instead: 'ai_reviewed' sits between 'machine_translated' and
-- 'human_reviewed' -- it discloses an AI QA pass, not a native-speaker human review.
alter type translation_status add value if not exists 'ai_reviewed' after 'machine_translated';
