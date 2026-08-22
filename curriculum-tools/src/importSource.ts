#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parsePdf } from './parsers/pdfParser.js'
import { parseDocx } from './parsers/docxParser.js'
import { parseHtml } from './parsers/htmlParser.js'
import { parseText } from './parsers/textParser.js'
import {
  detectGrades,
  detectTerms,
  detectTopicCandidates,
  dropRepeatedRunningText,
  dropKnownBoilerplate,
} from './detectors/curriculumDetectors.js'
import type { ExtractedDocument } from './parsers/types.js'

/** Tags every record this run creates or updates, so a later reprocessing
 * pass can identify and replace exactly what a prior version wrote (Priority
 * 7's explicit "delete/rebuild the imported candidate layer... create a new
 * import version" — never patch old rows in place). Bump this string, not
 * the pipeline's actual version, when a new deliberate reprocessing pass
 * begins. */
const IMPORT_VERSION = '2026-08-21-v2.1'

/**
 * Curriculum source importer — the executable half of spec section 10's
 * pipeline (PDF -> extract -> classify -> grade/subject/term/topic detection
 * -> curriculum database -> admin review -> verified -> published). This CLI
 * covers everything up to "curriculum database": it writes REVIEW_REQUIRED
 * records only. Nothing it writes is ever auto-VERIFIED or auto-PUBLISHED —
 * that transition is a deliberate admin action (see the admin review API).
 *
 * Usage:
 *   npm run import -- --file <path> --document-id <manifest-doc-id> [--dry-run]
 *
 * Required env vars for a real (non-dry-run) import:
 *   SUPABASE_URL                 — same project URL as the main app
 *   SUPABASE_SERVICE_ROLE_KEY    — service role key (server-side only, NEVER
 *                                  the anon/publishable key: the RLS policies
 *                                  on curriculum tables require is_admin() for
 *                                  writes, and this script runs unattended,
 *                                  outside any parent's authenticated session)
 * Neither is present in this repository. --dry-run needs neither — it only
 * extracts and prints candidates, and writes nothing to the database.
 */

interface Args {
  file: string
  documentId: string
  dryRun: boolean
  /** Which CAPS grade(s) this run should extract, by grade number. Required
   * whenever the source PDF covers more than one grade (every CAPS document
   * in practice — a whole phase per file) so a Senior Phase (7-9) document
   * can be told "only Grade 7" without also writing Grade 8/9 topics that
   * have nowhere to attach (this product has no Grade 8/9 rows yet). */
  grades: number[]
  /** Write the full (untruncated) filtered candidate list as JSON to this
   * path instead of / in addition to writing to the database. Useful when
   * the caller already has privileged DB access through another path (e.g.
   * an MCP tool) and would rather construct the inserts itself than export
   * a service-role key into this process's environment. */
  dumpJson?: string
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const file = get('--file')
  const documentId = get('--document-id')
  const gradesArg = get('--grades')
  if (!file || !documentId || !gradesArg) {
    throw new Error(
      'Usage: npm run import -- --file <path> --document-id <manifest-doc-id> --grades <comma-separated-grade-numbers> [--dry-run] [--dump-json <path>]',
    )
  }
  const grades = gradesArg.split(',').map((s) => Number(s.trim()))
  if (grades.some((g) => !Number.isInteger(g) || g < 1 || g > 12)) {
    throw new Error(`Invalid --grades value: "${gradesArg}"`)
  }
  return { file, documentId, dryRun: argv.includes('--dry-run'), grades, dumpJson: get('--dump-json') }
}

async function extract(filePath: string): Promise<ExtractedDocument> {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return parsePdf(filePath)
  if (ext === '.docx') return parseDocx(filePath)
  if (ext === '.html' || ext === '.htm') return parseHtml(filePath)
  if (ext === '.txt') return parseText(filePath)
  throw new Error(`Unsupported file extension: ${ext}. Supported: .pdf .docx .html .htm .txt`)
}

async function checksumOf(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

async function appendImportLog(entry: Record<string, unknown>) {
  const logPath = path.resolve(import.meta.dirname, '../../curriculum/import-log.json')
  const log = JSON.parse(await readFile(logPath, 'utf-8')) as { runs: unknown[] }
  log.runs.push(entry)
  await writeFile(logPath, JSON.stringify(log, null, 2) + '\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!existsSync(args.file)) {
    throw new Error(`File not found: ${args.file}`)
  }

  console.log(`Extracting ${args.file} ...`)
  const doc = await extract(args.file)
  const checksum = await checksumOf(args.file)
  console.log(`Extracted ${doc.blocks.length} blocks across ${doc.pageCount ?? '?'} page(s). Checksum: ${checksum}`)

  const grades = detectGrades(doc.blocks)
  const terms = detectTerms(doc.blocks)
  const { topics: allTopics, assessmentNotes: allAssessmentNotes } = detectTopicCandidates(doc.blocks)
  const inScope = allTopics.filter((t) => t.gradeNumber !== null && args.grades.includes(t.gradeNumber))
  const deBoilerplated = dropKnownBoilerplate(inScope)
  const topics = dropRepeatedRunningText(deBoilerplated)
  const outOfScopeCount = allTopics.length - inScope.length
  const boilerplateCount = inScope.length - deBoilerplated.length
  const runningHeaderCount = deBoilerplated.length - topics.length
  // Unlike topics, a null gradeNumber here is NOT "out of scope, skip it" —
  // it's a deliberate, honest "this assessment note doesn't specify a
  // grade" (see curriculumDetectors.ts's A5 fix: a trailing assessment
  // appendix's ambient "last grade mentioned" is not the same as the note
  // actually being about that grade). assessment_notes.grade_id is
  // nullable specifically for this, and unlike topics.grade_id there's no
  // launch-gating concern (a null grade never needs a grades-table row to
  // exist), so every grade-general note is always in scope alongside the
  // ones that do carry a specific, in-scope grade.
  const assessmentNotes = allAssessmentNotes.filter(
    (n) => n.gradeNumber === null || args.grades.includes(n.gradeNumber),
  )

  console.log(`\nDetected (heuristic, unverified):`)
  console.log(`  Grades present in document: ${[...new Set(grades.map((g) => g.gradeNumber))].join(', ') || 'none'}`)
  console.log(`  Grades this run will extract: ${args.grades.join(', ')}`)
  console.log(`  Terms:  ${[...new Set(terms.map((t) => t.termNumber))].join(', ') || 'none'}`)
  console.log(
    `  Topic candidates in scope: ${topics.length} (${outOfScopeCount} skipped — no grade marker seen yet, or a different grade than requested; ${boilerplateCount} skipped — known CAPS document boilerplate; ${runningHeaderCount} skipped — repeated running header/footer text)`,
  )
  console.log(
    `  Assessment guidance/appendix notes in scope: ${assessmentNotes.length} (stored separately, never as a curriculum topic)`,
  )
  for (const t of topics.slice(0, 20)) {
    console.log(`    - [Grade ${t.gradeNumber}, Term ${t.termNumber ?? '?'}] "${t.text}" (${t.block.sourceLocation})`)
  }
  if (topics.length > 20) console.log(`    ... and ${topics.length - 20} more`)

  if (args.dumpJson) {
    await writeFile(
      args.dumpJson,
      JSON.stringify(
        {
          documentId: args.documentId,
          file: args.file,
          checksum,
          pageCount: doc.pageCount,
          gradesRequested: args.grades,
          importVersion: IMPORT_VERSION,
          candidates: topics.map((t) => ({
            gradeNumber: t.gradeNumber,
            termNumber: t.termNumber,
            text: t.text,
            page: t.block.page,
            sourceLocation: t.block.sourceLocation,
            extractionMethod: t.extractionMethod,
            confidenceScore: t.confidenceScore,
            bbox: t.bbox ?? null,
            sourceTextHash: hashOf(t.text),
          })),
          assessmentNotes: assessmentNotes.map((n) => ({
            category: n.category,
            gradeNumber: n.gradeNumber,
            termNumber: n.termNumber,
            text: n.text,
            page: n.block.page,
            sourceLocation: n.block.sourceLocation,
            extractionMethod: n.extractionMethod,
            confidenceScore: n.confidenceScore,
            bbox: n.bbox ?? null,
            sourceTextHash: hashOf(n.text),
          })),
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`\nWrote ${topics.length} candidate(s) and ${assessmentNotes.length} assessment note(s) to ${args.dumpJson}`)
  }

  const runEntry = {
    document: args.documentId,
    file: args.file,
    checksum,
    date_imported: new Date().toISOString(),
    pages_processed: doc.pageCount,
    records_created: 0,
    records_needing_review: 0,
    errors: [] as string[],
    status: args.dryRun ? 'DRY_RUN' : 'PENDING_DB_WRITE',
  }

  if (args.dryRun) {
    console.log('\n--dry-run set: nothing written to the database or import log.')
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    runEntry.status = 'FAILED'
    runEntry.errors.push('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.')
    await appendImportLog(runEntry)
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to write to the database. ' +
        'Re-run with --dry-run to extract and preview without writing anything.',
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: source, error: sourceError } = await supabase
    .from('curriculum_sources')
    .select('id, grade_id, subject_id')
    .eq('document_id', args.documentId)
    .maybeSingle()

  if (sourceError || !source) {
    runEntry.status = 'FAILED'
    runEntry.errors.push(
      `No curriculum_sources row found for document_id="${args.documentId}". ` +
        'Create one first (matching curriculum/sources/manifest.json) before importing its content.',
    )
    await appendImportLog(runEntry)
    throw new Error(runEntry.errors[0])
  }
  if (!source.subject_id) {
    runEntry.status = 'FAILED'
    runEntry.errors.push(`curriculum_sources row for "${args.documentId}" has no subject_id set.`)
    await appendImportLog(runEntry)
    throw new Error(runEntry.errors[0])
  }

  const { data: subjectRow } = await supabase
    .from('subjects')
    .select('curriculum_id')
    .eq('id', source.subject_id)
    .maybeSingle()
  if (!subjectRow) {
    runEntry.status = 'FAILED'
    runEntry.errors.push(`Subject ${source.subject_id} not found.`)
    await appendImportLog(runEntry)
    throw new Error(runEntry.errors[0])
  }

  // The document may cover a whole phase (e.g. Grades 7-9 in one PDF); each
  // topic candidate carries the specific grade its own section marker named
  // (see detectTopicCandidates), so grade_id is resolved per-candidate here
  // rather than once for the whole source — never from source.grade_id,
  // which is intentionally left null on a multi-grade source record.
  const { data: gradeRows } = await supabase
    .from('grades')
    .select('id, grade_number')
    .eq('curriculum_id', subjectRow.curriculum_id)
    .in('grade_number', args.grades)
  const gradeIdByNumber = new Map((gradeRows ?? []).map((g) => [g.grade_number, g.id]))

  await supabase
    .from('curriculum_sources')
    .update({ status: 'PARSED', import_date: new Date().toISOString(), checksum, updated_at: new Date().toISOString() })
    .eq('id', source.id)

  let recordsCreated = 0
  const errors: string[] = []

  for (const candidate of topics) {
    const gradeId = candidate.gradeNumber !== null ? gradeIdByNumber.get(candidate.gradeNumber) : undefined
    if (!gradeId) {
      errors.push(
        `Skipped "${candidate.text}": no grades row for grade ${candidate.gradeNumber} under this curriculum — ` +
          'this product has not launched that grade yet, or --grades was not passed correctly.',
      )
      continue
    }
    const { data: term } = await supabase
      .from('terms')
      .select('id')
      .eq('grade_id', gradeId)
      .eq('term_number', candidate.termNumber ?? 1)
      .maybeSingle()

    const { error: insertError } = await supabase.from('topics').insert({
      subject_id: source.subject_id,
      grade_id: gradeId,
      term_id: term?.id ?? null,
      code: candidate.text.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40),
      name: candidate.text,
      is_demo_content: false,
      content_workflow_status: 'REVIEW_REQUIRED',
      source_id: source.id,
      source_page: candidate.block.page ? String(candidate.block.page) : null,
      source_section: candidate.block.sourceLocation,
      extraction_method: candidate.extractionMethod,
      confidence_score: candidate.confidenceScore,
      import_version: IMPORT_VERSION,
      source_coordinates: candidate.bbox ?? null,
      source_text_hash: hashOf(candidate.text),
    })

    if (insertError) errors.push(`"${candidate.text}": ${insertError.message}`)
    else recordsCreated++
  }

  let assessmentNotesCreated = 0
  for (const note of assessmentNotes) {
    const gradeId = note.gradeNumber !== null ? gradeIdByNumber.get(note.gradeNumber) : undefined
    const termId = gradeId
      ? (
          await supabase
            .from('terms')
            .select('id')
            .eq('grade_id', gradeId)
            .eq('term_number', note.termNumber ?? 1)
            .maybeSingle()
        ).data?.id ?? null
      : null

    const { error: insertError } = await supabase.from('assessment_notes').insert({
      subject_id: source.subject_id,
      grade_id: gradeId ?? null,
      term_id: termId,
      category: note.category,
      text: note.text,
      content_workflow_status: 'REVIEW_REQUIRED',
      source_id: source.id,
      source_page: note.block.page ? String(note.block.page) : null,
      source_section: note.block.sourceLocation,
      extraction_method: note.extractionMethod,
      confidence_score: note.confidenceScore,
      import_version: IMPORT_VERSION,
      source_coordinates: note.bbox ?? null,
      source_text_hash: hashOf(note.text),
    })

    if (insertError) errors.push(`assessment note "${note.text.slice(0, 40)}...": ${insertError.message}`)
    else assessmentNotesCreated++
  }

  await supabase
    .from('curriculum_sources')
    .update({ status: recordsCreated > 0 ? 'REVIEW_REQUIRED' : 'PARSED', updated_at: new Date().toISOString() })
    .eq('id', source.id)

  runEntry.records_created = recordsCreated
  runEntry.records_needing_review = recordsCreated
  runEntry.errors = errors
  runEntry.status = errors.length > 0 && recordsCreated === 0 ? 'FAILED' : 'REVIEW_REQUIRED'
  await appendImportLog(runEntry)

  console.log(
    `\nCreated ${recordsCreated} topic candidate(s) and ${assessmentNotesCreated} assessment note(s), all content_workflow_status=REVIEW_REQUIRED, import_version=${IMPORT_VERSION}.`,
  )
  if (errors.length > 0) console.log(`${errors.length} error(s) — see curriculum/import-log.json.`)
  console.log('Nothing here is visible to learners until an admin reviews and publishes it.')
}

main().catch((err) => {
  console.error(`\nImport failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
