#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { parsePdf } from '../parsers/pdfParser.js'
import { detectTopicCandidates, dropKnownBoilerplate, dropRepeatedRunningText, classifyBlock } from '../detectors/curriculumDetectors.js'
import type { BoundingBox, ExtractedBlock } from '../parsers/types.js'
import { extractSecondaryPageText } from './secondaryExtraction.js'
import {
  normalizeForMatch,
  findSourceTextMatch,
  isPlausibleText,
  classifyShape,
  classifyGradeEvidence,
  classifyTermEvidence,
  detectDuplicates,
  decide,
  type SourceStatus,
} from './engine.js'

/**
 * Runs the V2.2 automated validation pass for real, against the 9 original
 * source PDFs and the actual V2.1 database snapshot (dumped to the TSV/JSON
 * files this script reads — see curriculum/validation/). Writes one result
 * row per topics/assessment_notes record to curriculum/validation/results-
 * *.jsonl, which the operator applies to the live database as UPDATEs
 * (this script has no DB write access — see importSource.ts's own doc for
 * why: no service-role key exists in this repo).
 *
 * This is a read-only, side-effect-free script apart from its own output
 * files: it never touches the database, never mutates the source PDFs, and
 * never mutates the V2.1 in-memory candidates it reproduces (they're used
 * only to look up bbox/term-evidence for the ALREADY-IMPORTED DB rows this
 * script is validating, not written anywhere new).
 */

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..')
const VALIDATION_VERSION = '2026-08-22-v2.2-validation'

// Must match the actual grades each source document was imported for (see
// curriculum/import-log.json / curriculum-tools/README) — re-extraction has
// to request the same scope the real import did, or it will "fail to
// reproduce" every candidate for no real reason.
const DOCUMENT_GRADES: Record<string, number[]> = {
  'dbe-caps-math-ip': [4, 5, 6],
  'dbe-caps-lifeskills-ip': [4, 5, 6],
  'dbe-caps-nst-ip-amendment': [4, 5, 6],
  'dbe-caps-socsci-ip': [4, 5, 6],
  'dbe-caps-math-sp': [7],
  'dbe-caps-natsci-sp': [7],
  'dbe-caps-tech-sp': [7],
  'dbe-caps-creativearts-sp': [7],
  'dbe-caps-humansocsci-sp': [7],
}

interface SourceRow {
  id: string
  document_id: string
  local_file_path: string
  source_status: SourceStatus
}

interface TopicRow {
  id: string
  subject_id: string
  grade_number: number | null
  term_number: number | null
  name: string
  source_id: string
  source_page: string | null
  source_section: string
  extraction_method: string
  confidence_score: number
}

interface AssessmentNoteRow extends Omit<TopicRow, 'name'> {
  category: string
  text: string
}

function parseTopicsTsv(tsv: string): TopicRow[] {
  return tsv
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const [id, subject_id, grade, term, name, source_id, page, source_section, extraction_method, confidence] =
        line.split('\t')
      return {
        id,
        subject_id,
        grade_number: grade ? Number(grade) : null,
        term_number: term ? Number(term) : null,
        name,
        source_id,
        source_page: page || null,
        source_section,
        extraction_method,
        confidence_score: Number(confidence),
      }
    })
}

function parseAssessmentNotesTsv(tsv: string): AssessmentNoteRow[] {
  return tsv
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const [id, subject_id, grade, term, category, text, source_id, page, source_section, extraction_method, confidence] =
        line.split('\t')
      return {
        id,
        subject_id,
        grade_number: grade ? Number(grade) : null,
        term_number: term ? Number(term) : null,
        category,
        text,
        source_id,
        source_page: page || null,
        source_section,
        extraction_method,
        confidence_score: Number(confidence),
      }
    })
}

interface ReExtractedCandidate {
  page: number | null
  bbox: BoundingBox | undefined
  termNumberWasNull: boolean
}

function candidateKey(page: number | null, extractionMethod: string, text: string): string {
  return `${page}${extractionMethod}${normalizeForMatch(text)}`
}

async function reExtractDocument(filePath: string, grades: number[]) {
  const doc = await parsePdf(filePath)
  const { topics: allTopics, assessmentNotes: allAssessmentNotes } = detectTopicCandidates(doc.blocks)
  const inScope = allTopics.filter((t) => t.gradeNumber !== null && grades.includes(t.gradeNumber))
  const deBoilerplated = dropKnownBoilerplate(inScope)
  const topics = dropRepeatedRunningText(deBoilerplated)
  const assessmentNotes = allAssessmentNotes.filter((n) => n.gradeNumber === null || grades.includes(n.gradeNumber))

  const topicIndex = new Map<string, ReExtractedCandidate>()
  for (const t of topics) {
    topicIndex.set(candidateKey(t.block.page, t.extractionMethod, t.text), {
      page: t.block.page,
      bbox: t.bbox,
      termNumberWasNull: t.termNumber === null,
    })
  }
  const noteIndex = new Map<string, ReExtractedCandidate>()
  for (const n of assessmentNotes) {
    noteIndex.set(candidateKey(n.block.page, n.extractionMethod, n.text), {
      page: n.block.page,
      bbox: n.bbox,
      termNumberWasNull: n.termNumber === null,
    })
  }
  return { topicIndex, noteIndex, topicCount: topics.length, noteCount: assessmentNotes.length }
}

function syntheticBlock(text: string): ExtractedBlock {
  return { type: 'paragraph', text, page: null, headingLevel: null, tableCells: null, sourceLocation: '' }
}

function isValidBbox(bbox: BoundingBox | undefined | null): boolean {
  return !!bbox && bbox.xMax > bbox.xMin
}

interface ValidationResultRow {
  id: string
  table: 'topics' | 'assessment_notes'
  validation_status: string
  validation_confidence: number
  validation_method: string[]
  validation_reason: string
  secondary_extraction_match: boolean
  source_coordinates: BoundingBox | null
  source_text_hash: string
  source_snippet: string | null
}

async function main() {
  const sourcesRaw = await readFile(path.join(REPO_ROOT, 'curriculum/validation/sources.json'), 'utf-8')
  const sources: SourceRow[] = JSON.parse(sourcesRaw)
  const sourceById = new Map(sources.map((s) => [s.id, s]))

  const topicsTsv = await readFile(path.join(REPO_ROOT, 'curriculum/validation/topics-snapshot.tsv'), 'utf-8')
  const notesTsv = await readFile(path.join(REPO_ROOT, 'curriculum/validation/assessment-notes-snapshot.tsv'), 'utf-8')
  const topicRows = parseTopicsTsv(topicsTsv)
  const noteRows = parseAssessmentNotesTsv(notesTsv)

  console.log(`Loaded ${topicRows.length} topic rows, ${noteRows.length} assessment_note rows, ${sources.length} sources.`)

  const topicIndexBySource = new Map<string, Map<string, ReExtractedCandidate>>()
  const noteIndexBySource = new Map<string, Map<string, ReExtractedCandidate>>()
  const secondaryTextBySource = new Map<string, Map<number, string>>()

  for (const source of sources) {
    const grades = DOCUMENT_GRADES[source.document_id]
    if (!grades) throw new Error(`No grade scope configured for document ${source.document_id}`)
    const filePath = path.join(REPO_ROOT, source.local_file_path)
    console.log(`Re-extracting ${source.document_id} (${filePath}) ...`)
    const { topicIndex, noteIndex, topicCount, noteCount } = await reExtractDocument(filePath, grades)
    topicIndexBySource.set(source.id, topicIndex)
    noteIndexBySource.set(source.id, noteIndex)
    console.log(`  re-extracted ${topicCount} topics, ${noteCount} assessment notes (for reproducibility/coordinate lookup).`)

    const secondary = await extractSecondaryPageText(filePath)
    secondaryTextBySource.set(source.id, secondary.byPage)
    console.log(`  secondary (Method B) text extracted for ${secondary.pageCount} pages.`)
  }

  // Duplicate detection, scoped per table (a topic and an assessment note
  // sharing text are never "the same record" — different tables entirely).
  const topicDuplicates = detectDuplicates(
    topicRows.map((r) => ({ id: r.id, subjectId: r.subject_id, gradeNumber: r.grade_number, termNumber: r.term_number, text: r.name })),
  )
  // Deliberately NOT running the same duplicate check on assessment_notes:
  // checked against the real data, short generic assessment-programme labels
  // ("Investigation", "Test", "20 marks") legitimately recur many times
  // across a real mark-allocation/assessment table — that is expected source
  // content, not double-extraction. Applying the topics-table duplicate key
  // here produced ~165 false CONFLICTING flags in an earlier run of this
  // script, all traceable to this exact cause; disabled rather than shipped
  // with a misleading number. Genuine assessment_notes duplication (the same
  // block literally processed twice) is a much narrower, rarer failure mode
  // this pass does not attempt to distinguish from legitimate repetition.
  const noteDuplicates = new Map<string, string>()

  const results: ValidationResultRow[] = []
  const summary = { AUTO_VERIFIED: 0, AUTO_VALIDATED: 0, REVIEW_REQUIRED: 0, SOURCE_INCOMPLETE: 0, NON_CURRICULUM: 0, CONFLICTING: 0 }

  function validateOne(
    id: string,
    table: 'topics' | 'assessment_notes',
    text: string,
    sourceId: string,
    sourcePage: string | null,
    sourceSection: string,
    extractionMethod: string,
    duplicateOfId: string | undefined,
    expectCurriculumTopic: boolean,
  ) {
    const source = sourceById.get(sourceId)
    const sourceStatus: SourceStatus = source?.source_status ?? 'UNKNOWN'
    const page = sourcePage ? Number(sourcePage) : null
    const shape = classifyShape(sourceSection, extractionMethod)

    const index = table === 'topics' ? topicIndexBySource.get(sourceId) : noteIndexBySource.get(sourceId)
    const reExtracted = index?.get(candidateKey(page, extractionMethod, text))
    const reExtractionReproduced = !!reExtracted
    const bbox = reExtracted?.bbox ?? null
    const originalTermNumberWasNull = reExtracted?.termNumberWasNull ?? false

    const secondaryPages = sourceId ? secondaryTextBySource.get(sourceId) : undefined
    const pageText = page !== null ? secondaryPages?.get(page) ?? null : null
    const match = findSourceTextMatch(text, pageText)
    const plausibility = isPlausibleText(text)
    // Re-classifying bare text is only a fair, meaningful re-check for the
    // topics table: classifyBlock's ASSESSMENT_GUIDANCE/APPENDIX/TOC patterns
    // are wording-based, and a genuine topic's own text should never
    // accidentally match them. It is NOT a fair check for assessment_notes:
    // many of those were originally routed there by table/section-level
    // context (inAssessmentSection state, or another column's wording — see
    // curriculumDetectors.ts's detectTopicCandidates) that isn't preserved
    // per-row, so a generic short label like "Investigation" or "20 marks"
    // would fail a bare-text re-check for a reason that has nothing to do
    // with whether it was correctly classified. Disclosed limitation: this
    // pass does not attempt to independently re-verify assessment_notes'
    // classification; classificationConfirmed is trivially true for that
    // table (they were never candidates for AUTO_VERIFIED as a curriculum
    // topic in the first place, so this gate isn't doing safety-relevant
    // work there the way it does for topics).
    const classificationConfirmed = expectCurriculumTopic ? classifyBlock(syntheticBlock(text)) === 'CURRICULUM_TOPIC' : true

    const gradeEvidence = classifyGradeEvidence(shape)
    const termEvidence = classifyTermEvidence(shape, originalTermNumberWasNull)

    const decisionInput = {
      exactSourceTextMatch: match.matched,
      sourceStatus,
      classificationConfirmed,
      gradeEvidence,
      termEvidence,
      reExtractionReproduced,
      isDuplicate: !!duplicateOfId,
      isRotatedSource: shape === 'ROTATED',
      isGenericFallback: shape === 'GENERIC_FALLBACK' || shape === 'HEADING_TEXT',
      plausible: plausibility.plausible,
      hasValidCoordinates: isValidBbox(bbox),
      duplicateOfId: duplicateOfId ?? null,
    }
    const result = decide(decisionInput)
    // Recompute the same factors decide() used internally, for storage.
    const factors: string[] = []
    if (match.matched) factors.push(match.matchType === 'contiguous' ? 'exact_source_text_match' : 'exact_source_text_match_subsequence')
    if (sourceStatus === 'COMPLETE') factors.push('source_complete')
    if (classificationConfirmed) factors.push('classification_confirmed')
    if (gradeEvidence === 'STRUCTURAL') factors.push('grade_evidence_structural')
    else if (gradeEvidence === 'MARKER') factors.push('grade_evidence_marker')
    if (termEvidence === 'STRUCTURAL' || termEvidence === 'MARKER') factors.push('term_evidence_present')
    else if (termEvidence === 'AMBIENT') factors.push('term_evidence_ambient')
    else if (termEvidence === 'DEFAULTED_NO_EVIDENCE') factors.push('term_defaulted_without_evidence')
    if (reExtractionReproduced) factors.push('primary_reextraction_reproduced')
    if (!duplicateOfId) factors.push('no_duplicate_conflict')
    if (decisionInput.isRotatedSource) factors.push('rotated_text_uncertainty')
    if (decisionInput.isGenericFallback) factors.push('generic_fallback_method')
    if (!plausibility.plausible) factors.push('malformed_source_text')

    // Re-derive the numeric score the same way decide() does internally, by
    // importing computeConfidence would duplicate the call decide() already
    // made — cheaper to just recompute it here directly for storage.
    let score = 0.1
    if (match.matched) score += 0.3
    if (sourceStatus === 'COMPLETE') score += 0.15
    if (classificationConfirmed) score += 0.15
    if (gradeEvidence === 'STRUCTURAL') score += 0.15
    else if (gradeEvidence === 'MARKER') score += 0.08
    if (termEvidence === 'STRUCTURAL' || termEvidence === 'MARKER') score += 0.1
    else if (termEvidence === 'AMBIENT') score += 0.03
    else if (termEvidence === 'DEFAULTED_NO_EVIDENCE') score -= 0.25
    if (reExtractionReproduced) score += 0.1
    if (!duplicateOfId) score += 0.1
    if (decisionInput.isRotatedSource) score -= 0.35
    if (decisionInput.isGenericFallback) score -= 0.2
    if (!plausibility.plausible) score -= 0.3
    score = Math.max(0, Math.min(1, Math.round(score * 1000) / 1000))

    summary[result.status as keyof typeof summary]++
    results.push({
      id,
      table,
      validation_status: result.status,
      validation_confidence: score,
      validation_method: factors,
      validation_reason: result.reason,
      secondary_extraction_match: match.matched,
      source_coordinates: bbox,
      source_text_hash: createHash('sha256').update(text).digest('hex'),
      source_snippet: match.snippet,
    })
  }

  for (const row of topicRows) {
    validateOne(
      row.id,
      'topics',
      row.name,
      row.source_id,
      row.source_page,
      row.source_section,
      row.extraction_method,
      topicDuplicates.get(row.id),
      true,
    )
  }
  for (const row of noteRows) {
    validateOne(
      row.id,
      'assessment_notes',
      row.text,
      row.source_id,
      row.source_page,
      row.source_section,
      row.extraction_method,
      noteDuplicates.get(row.id),
      false,
    )
  }

  const outDir = path.join(REPO_ROOT, 'curriculum/validation')
  await writeFile(
    path.join(outDir, 'results-topics.jsonl'),
    results.filter((r) => r.table === 'topics').map((r) => JSON.stringify(r)).join('\n') + '\n',
  )
  await writeFile(
    path.join(outDir, 'results-assessment-notes.jsonl'),
    results.filter((r) => r.table === 'assessment_notes').map((r) => JSON.stringify(r)).join('\n') + '\n',
  )
  await writeFile(
    path.join(outDir, 'validation-summary.json'),
    JSON.stringify({ validationVersion: VALIDATION_VERSION, generatedAt: new Date().toISOString(), totalRecords: results.length, summary }, null, 2) + '\n',
  )

  console.log('\nValidation summary:')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\nWrote ${results.length} result rows to curriculum/validation/results-*.jsonl`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
