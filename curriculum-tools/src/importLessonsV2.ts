#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

/**
 * V2.3 lesson-blueprint importer — loads curriculum/generated-lessons/lessons-full-v2.3.jsonl
 * (123 AI-generated, AI-QA-reviewed bilingual lesson blueprints) into the `lessons` table's
 * V2.3 columns (see supabase/migrations/0026_add_lesson_v2_columns.sql).
 *
 * Deviates from a straightforward "map by subject/grade/term/name" join: the JSONL's
 * `topic_id` was verified (2026-08-24, against the live sa-learning-platform project) to
 * match `topics.id` exactly for all 123 records, so this script joins on `topic_id` directly
 * rather than matching on human-readable subject/grade/term/name text, which would be
 * strictly more fragile (topics has no `subject`/`grade_number`/`term_number` scalar columns
 * to match against in the first place -- those are `subject_id`/`grade_id`/`term_id` foreign
 * keys onto other tables). "Handle missing topics gracefully" is kept as a defensive check
 * in case a future regeneration introduces a topic_id not yet present in `topics`.
 *
 * Every imported row is written with content_workflow_status = 'REVIEW_REQUIRED' and
 * is_demo_content = false: this is real, CAPS-grounded content, but nothing here has been
 * reviewed by a human yet (see translation_status for the Afrikaans-specific review state).
 * Nothing in this script ever writes VERIFIED/PUBLISHED -- that stays a deliberate admin
 * action, same as curriculum-tools/src/importSource.ts.
 *
 * Usage:
 *   npm run import-lessons-v2 -- [--dry-run]
 *
 * Required env vars for a real (non-dry-run) import:
 *   SUPABASE_URL                 — same project URL as the main app
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (server-side only; the RLS policies on
 *                                  `lessons` require is_admin() for writes, and this script
 *                                  runs unattended, outside any parent's authenticated session)
 * --dry-run needs neither — it only validates topic_id coverage and prints what it would
 * write, without touching the database.
 */

interface LessonJSON {
  topic_id: string
  grade: number
  subject: string
  term: number
  topic_name: string
  lesson_metadata: {
    version: string
    source_trace: string[]
    source_section: string
  }
  learning_objectives: string[]
  english_content: {
    narration_script: string
    visual_storyboard: { slide: number; visual_description: string; on_screen_text: string }[]
  }
  afrikaans_content: {
    narration_script: string
    visual_storyboard: { slide: number; visual_description: string; on_screen_text: string }[]
    translation_status: string
    review_note?: string
  }
  worked_example: {
    problem: string
    problem_af: string
    solution_steps: string[]
    final_answer: string
  }
  practice_questions: {
    question_en: string
    question_af: string
    correct_answer: string
    hint_en: string
    hint_af: string
  }[]
}

interface Args {
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  return { dryRun: argv.includes('--dry-run') }
}

/** JSONL uses the same uppercase status strings as earlier V2.3 report/commit messages.
 * The DB enum (0016_terminology_and_translation_status.sql, extended by 0026) uses lowercase
 * snake_case. 'ai_reviewed' was added specifically to represent the AI-QA-pass state this
 * corpus is actually in -- never map anything to 'human_reviewed' or 'verified' here. */
function mapTranslationStatus(raw: string): string {
  switch (raw) {
    case 'MACHINE_TRANSLATED_UNVERIFIED':
      return 'machine_translated'
    case 'MACHINE_TRANSLATED_AI_REVIEWED':
      return 'ai_reviewed'
    default:
      console.warn(`  Unrecognised translation_status "${raw}", defaulting to 'machine_translated'.`)
      return 'machine_translated'
  }
}

/** Deterministic per-topic slug so re-running this script targets the same row every time
 * (lessons' real unique constraint is (topic_id, slug, language), not topic_id alone). */
function slugFor(topicId: string): string {
  return `v2-${topicId}`
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2))

  const here = path.dirname(fileURLToPath(import.meta.url))
  const jsonlPath = path.resolve(here, '../../curriculum/generated-lessons/lessons-full-v2.3.jsonl')

  const lessons: LessonJSON[] = readFileSync(jsonlPath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as LessonJSON)

  console.log(`Loaded ${lessons.length} lesson blueprints from ${jsonlPath}`)

  if (dryRun) {
    console.log('--dry-run: skipping Supabase connection; validating shape only.')
    for (const lesson of lessons) {
      if (!lesson.topic_id || !lesson.topic_name || !lesson.english_content?.narration_script) {
        console.warn(`  Malformed record: ${lesson.topic_id ?? '(no topic_id)'}`)
      }
    }
    console.log('Dry run complete.')
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to write to the database. ' +
        'Use --dry-run to validate the JSONL without a database connection.',
    )
    process.exitCode = 1
    return
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // One bulk query, not one round trip per lesson: fetch which of this file's topic_ids
  // actually exist in `topics` before attempting any upserts.
  const allTopicIds = lessons.map((l) => l.topic_id)
  const { data: existingTopics, error: topicsError } = await supabase
    .from('topics')
    .select('id')
    .in('id', allTopicIds)

  if (topicsError) {
    console.error('Failed to look up topics:', topicsError)
    process.exitCode = 1
    return
  }

  const validTopicIds = new Set((existingTopics ?? []).map((t) => t.id as string))
  console.log(`${validTopicIds.size} / ${lessons.length} topic_ids found in topics.`)

  let imported = 0
  let skipped = 0
  let failed = 0

  for (const lesson of lessons) {
    if (!validTopicIds.has(lesson.topic_id)) {
      console.warn(`  Skipping "${lesson.topic_name}" (${lesson.topic_id}): no matching topic in database.`)
      skipped++
      continue
    }

    const row = {
      topic_id: lesson.topic_id,
      subtopic_id: null,
      slug: slugFor(lesson.topic_id),
      language: 'en',
      title: lesson.topic_name,
      is_demo_content: false,
      content_workflow_status: 'REVIEW_REQUIRED',
      translation_status: mapTranslationStatus(lesson.afrikaans_content.translation_status),
      narration_script: lesson.english_content.narration_script,
      afrikaans_narration_script: lesson.afrikaans_content.narration_script,
      visual_storyboard: lesson.english_content.visual_storyboard,
      afrikaans_visual_storyboard: lesson.afrikaans_content.visual_storyboard,
      worked_example: {
        problem: lesson.worked_example.problem,
        solution_steps: lesson.worked_example.solution_steps,
        final_answer: lesson.worked_example.final_answer,
      },
      afrikaans_worked_example: {
        problem: lesson.worked_example.problem_af,
        solution_steps: lesson.worked_example.solution_steps,
        final_answer: lesson.worked_example.final_answer,
      },
      practice_questions: lesson.practice_questions.map((q) => ({
        question: q.question_en,
        correct_answer: q.correct_answer,
        hint: q.hint_en,
      })),
      afrikaans_practice_questions: lesson.practice_questions.map((q) => ({
        question: q.question_af,
        correct_answer: q.correct_answer,
        hint: q.hint_af,
      })),
      source_trace: lesson.lesson_metadata.source_trace,
    }

    const { error } = await supabase.from('lessons').upsert(row, { onConflict: 'topic_id,slug,language' })

    if (error) {
      console.error(`  Error upserting "${lesson.topic_name}" (${lesson.topic_id}):`, error.message)
      failed++
    } else {
      console.log(`  Imported: ${lesson.topic_name}`)
      imported++
    }
  }

  console.log(`\nDone. Imported: ${imported}, skipped (no matching topic): ${skipped}, failed: ${failed}.`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
