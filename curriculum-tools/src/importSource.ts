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
import { detectGrades, detectTerms, detectTopicCandidates } from './detectors/curriculumDetectors.js'
import type { ExtractedDocument } from './parsers/types.js'

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
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const file = get('--file')
  const documentId = get('--document-id')
  if (!file || !documentId) {
    throw new Error('Usage: npm run import -- --file <path> --document-id <manifest-doc-id> [--dry-run]')
  }
  return { file, documentId, dryRun: argv.includes('--dry-run') }
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
  const topics = detectTopicCandidates(doc.blocks)

  console.log(`\nDetected (heuristic, unverified):`)
  console.log(`  Grades: ${[...new Set(grades.map((g) => g.gradeNumber))].join(', ') || 'none'}`)
  console.log(`  Terms:  ${[...new Set(terms.map((t) => t.termNumber))].join(', ') || 'none'}`)
  console.log(`  Topic candidates: ${topics.length}`)
  for (const t of topics.slice(0, 20)) {
    console.log(`    - [Term ${t.termNumber ?? '?'}] "${t.text}" (${t.block.sourceLocation})`)
  }
  if (topics.length > 20) console.log(`    ... and ${topics.length - 20} more`)

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

  await supabase
    .from('curriculum_sources')
    .update({ status: 'PARSED', import_date: new Date().toISOString(), checksum, updated_at: new Date().toISOString() })
    .eq('id', source.id)

  let recordsCreated = 0
  const errors: string[] = []

  for (const candidate of topics) {
    if (!source.subject_id || !source.grade_id) {
      errors.push(
        `Skipped "${candidate.text}": curriculum_sources row has no subject_id/grade_id set — ` +
          'set those on the source record (they identify which subject/grade this whole document covers) before importing.',
      )
      continue
    }
    const { data: term } = await supabase
      .from('terms')
      .select('id')
      .eq('grade_id', source.grade_id)
      .eq('term_number', candidate.termNumber ?? 1)
      .maybeSingle()

    const { error: insertError } = await supabase.from('topics').insert({
      subject_id: source.subject_id,
      grade_id: source.grade_id,
      term_id: term?.id ?? null,
      code: candidate.text.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40),
      name: candidate.text,
      is_demo_content: false,
      content_workflow_status: 'REVIEW_REQUIRED',
      source_id: source.id,
      source_page: candidate.block.page ? String(candidate.block.page) : null,
      source_section: candidate.block.sourceLocation,
    })

    if (insertError) errors.push(`"${candidate.text}": ${insertError.message}`)
    else recordsCreated++
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

  console.log(`\nCreated ${recordsCreated} topic candidate(s), all content_workflow_status=REVIEW_REQUIRED.`)
  if (errors.length > 0) console.log(`${errors.length} error(s) — see curriculum/import-log.json.`)
  console.log('Nothing here is visible to learners until an admin reviews and publishes it.')
}

main().catch((err) => {
  console.error(`\nImport failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
})
