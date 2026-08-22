/**
 * Deterministic, source-grounded validation/confidence engine for V2.1
 * curriculum candidates. Every function here is pure and unit-tested
 * (engine.test.ts) — no network, no LLM call, nothing probabilistic. The
 * whole point of this module is that a given input always produces the same
 * output, and that output can be explained in one sentence a human reviewer
 * can check against the source PDF themselves.
 *
 * This module NEVER decides a record is curriculum content the source
 * doesn't actually contain. Every positive signal here is "evidence found,"
 * never "evidence assumed." The absolute worst a bug in this file can do is
 * under-verify (leave something REVIEW_REQUIRED that a human would have
 * approved) — every code path is written to fail toward REVIEW_REQUIRED /
 * SOURCE_INCOMPLETE / CONFLICTING / NON_CURRICULUM, never toward
 * AUTO_VERIFIED, when evidence is missing or ambiguous.
 */

export type ValidationStatus =
  | 'AUTO_VALIDATED'
  | 'AUTO_VERIFIED'
  | 'REVIEW_REQUIRED'
  | 'SOURCE_INCOMPLETE'
  | 'NON_CURRICULUM'
  | 'CONFLICTING'

export type SourceStatus = 'COMPLETE' | 'INCOMPLETE' | 'AMENDMENT_ONLY' | 'UNKNOWN'

export type ExtractionShape =
  | 'GRADE_COLUMN'
  | 'LIFE_SKILLS'
  | 'CONTENT_OUTLINE'
  | 'ROTATED'
  | 'TOPIC_TIME_RESOURCE'
  | 'GENERIC_FALLBACK'
  | 'HEADING_TEXT'
  | 'UNKNOWN'

export type EvidenceTier = 'STRUCTURAL' | 'MARKER' | 'AMBIENT' | 'DEFAULTED_NO_EVIDENCE'

/** Normalizes only harmless, non-meaning-changing formatting differences:
 * unicode quote/dash variants to ASCII, and whitespace/newline runs to a
 * single space. Deliberately does NOT: fix spelling, expand a broken word,
 * join hyphenated line-wraps, or reorder/drop words — any of those would be
 * inventing text the source doesn't literally contain (see the task's own
 * "he solar ystem" example: this function leaves that exact string alone). */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface SourceTextMatchResult {
  matched: boolean
  snippet: string | null
  /** 'contiguous': the candidate appears as a literal run of text on the
   * page — the strongest form of evidence. 'subsequence': every word of the
   * candidate appears on the page, in the same order, but not as one
   * unbroken run — see findSourceTextMatch's doc for why this still counts
   * as real evidence rather than a weaker guess. null when unmatched. */
  matchType: 'contiguous' | 'subsequence' | null
}

interface Token {
  text: string
  start: number
  end: number
}

/** Splits into lowercase alphanumeric word tokens with their character
 * offsets in the ORIGINAL string — used only for locating a subsequence
 * match's snippet bounds, never for altering what counts as a match. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const re = /[a-z0-9]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    tokens.push({ text: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

/**
 * The one real "did the source actually say this" check, run two ways:
 *
 * 1. Contiguous: is the candidate (after only the harmless normalization in
 *    normalizeForMatch) a literal substring of the page's reading-order
 *    text? The strongest possible evidence — no fuzzy matching, no
 *    edit-distance tolerance.
 *
 * 2. Subsequence (tried only if #1 fails): do every one of the candidate's
 *    words appear on the page, in the same order, as plain word tokens
 *    (splitting on any non-alphanumeric run, so "1-digit" and "1 - digit"
 *    tokenize identically)? This exists because of a real, checked cause of
 *    false negatives on multi-column table shapes: the primary extractor
 *    correctly isolates one column's own wrapped text (e.g. a CONTENT cell),
 *    but the independent secondary extraction reads the WHOLE PAGE in plain
 *    top-to-bottom/left-to-right order, which — on a page where two columns'
 *    cells share a row's y-band — interleaves the OTHER column's text (or a
 *    DURATION value) between two wrapped lines of the SAME entry. Checked
 *    against a real failing case: page 24 of the Mathematics Grades 4-6 CAPS
 *    document reads "...by 1 - digit whole By breaking down technique. 2
 *    weeks numbers." — the genuine "1-digit whole ... numbers" entry, with
 *    "2 weeks" (that row's DURATION cell) genuinely sitting between "whole"
 *    and "numbers" in plain reading order. A contiguous-substring check
 *    fails this real, correctly-extracted candidate for a document-layout
 *    reason that has nothing to do with whether the text is genuine.
 *
 * A subsequence match is deliberately NOT the same strength as a contiguous
 * one — it just as deliberately is NOT a fuzzy or fabricated match either: a
 * garbled fragment (the rotated-table font-split's "he solar ystem") will
 * never subsequence-match "the solar system", because "he", "solar", and
 * "ystem" are different literal tokens from "the", "solar", "system" — this
 * check still can never "fix" or "complete" a broken word. */
export function findSourceTextMatch(candidateText: string, pageText: string | null): SourceTextMatchResult {
  if (!pageText) return { matched: false, snippet: null, matchType: null }

  const needle = normalizeForMatch(candidateText)
  const haystack = normalizeForMatch(pageText)
  if (needle.length === 0) return { matched: false, snippet: null, matchType: null }

  const idx = haystack.indexOf(needle)
  if (idx !== -1) {
    const start = Math.max(0, idx - 40)
    const end = Math.min(haystack.length, idx + needle.length + 40)
    return { matched: true, snippet: haystack.slice(start, end), matchType: 'contiguous' }
  }

  const needleTokens = tokenize(candidateText)
  if (needleTokens.length === 0) return { matched: false, snippet: null, matchType: null }
  const hayTokens = tokenize(pageText)

  let cursor = 0
  let firstStart = -1
  let lastEnd = -1
  for (const needleToken of needleTokens) {
    let found = false
    while (cursor < hayTokens.length) {
      const candidate = hayTokens[cursor]
      cursor++
      if (candidate.text === needleToken.text) {
        if (firstStart === -1) firstStart = candidate.start
        lastEnd = candidate.end
        found = true
        break
      }
    }
    if (!found) return { matched: false, snippet: null, matchType: null }
  }

  const snippet = pageText
    .slice(Math.max(0, firstStart - 20), Math.min(pageText.length, lastEnd + 20))
    .replace(/\s+/g, ' ')
    .trim()
  return { matched: true, snippet, matchType: 'subsequence' }
}

export interface PlausibilityResult {
  plausible: boolean
  reason?: string
}

/** A minimal, generic sanity filter on the stored text itself — catches
 * corrupted fragments (bullet leakage, near-empty strings, strings that are
 * almost entirely punctuation/digits) regardless of which detector produced
 * them. This is NOT a grammar or dictionary check; it exists only to stop
 * obviously-broken extractions from reaching AUTO_VERIFIED, not to judge
 * whether a genuine topic name "reads well". */
export function isPlausibleText(text: string): PlausibilityResult {
  const trimmed = text.trim()
  if (trimmed.length < 4) return { plausible: false, reason: 'too_short' }
  if (trimmed.includes('•')) return { plausible: false, reason: 'contains_bullet_marker' }
  const alpha = (trimmed.match(/[a-zA-Z]/g) ?? []).length
  if (alpha < 3) return { plausible: false, reason: 'insufficient_alphabetic_content' }
  if (alpha / trimmed.length < 0.5) return { plausible: false, reason: 'low_alphabetic_ratio' }
  return { plausible: true }
}

/** Which of this pipeline's known table shapes (or non-table paths) a
 * record's source_section string identifies — derived from the literal
 * sourceLocation strings pdfParser.ts writes (see that file), not guessed.
 * 'Life Skills' is checked before the generic 'topic/time/resource table'
 * substring since its own sourceLocation string ("...Life Skills topic/
 * time/resources table") would otherwise also match that looser check. */
export function classifyShape(sourceSection: string | null, extractionMethod: string | null): ExtractionShape {
  const s = sourceSection ?? ''
  if (s.includes('Life Skills topic/time/resources table')) return 'LIFE_SKILLS'
  if (s.includes('grade-column table')) return 'GRADE_COLUMN'
  if (s.includes('rotated content-outline table')) return 'ROTATED'
  if (s.includes('content-outline table')) return 'CONTENT_OUTLINE'
  if (s.includes('topic/time/resource table')) return 'TOPIC_TIME_RESOURCE'
  if (s.includes('detected table')) return 'GENERIC_FALLBACK'
  if (extractionMethod === 'pdf_text') return 'HEADING_TEXT'
  return 'UNKNOWN'
}

const STRUCTURAL_SHAPES: ExtractionShape[] = ['GRADE_COLUMN', 'LIFE_SKILLS']
const MARKER_SHAPES: ExtractionShape[] = ['CONTENT_OUTLINE', 'ROTATED', 'TOPIC_TIME_RESOURCE']

/** Grade evidence strength: STRUCTURAL when the table's own layout carries
 * the grade (a "Grade 7 | Grade 8 | Grade 9" column, or Life Skills' "GRADE
 * g" header) — the cell cannot be in the wrong grade without a boundary bug,
 * which coordinate/duplicate checks catch separately. MARKER when the grade
 * comes from an explicit "TERM n – Grade g" text marker earlier in the
 * document (real evidence, but sequential/ambient carry-forward between one
 * marker and the next, so a skipped or misread marker could mis-scope
 * several records at once). AMBIENT — the weakest, and never enough on its
 * own for AUTO_VERIFIED — is a generic-fallback table or a bare heading with
 * no structural or marker backing at all. */
export function classifyGradeEvidence(shape: ExtractionShape): EvidenceTier {
  if (STRUCTURAL_SHAPES.includes(shape)) return 'STRUCTURAL'
  if (MARKER_SHAPES.includes(shape)) return 'MARKER'
  return 'AMBIENT'
}

/** Term evidence follows the same shape-based tiers as grade evidence,
 * EXCEPT: if the original extraction candidate had no term number at all
 * (termNumber === null) and the importer nonetheless wrote a term_id by
 * defaulting to Term 1 (see importSource.ts's `candidate.termNumber ?? 1`),
 * that is not evidence of anything — it's an importer default masquerading
 * as a source-derived value, and the task's own absolute rule ("do not
 * infer a term merely because it was the last one encountered... if the
 * source does not clearly associate a topic with a term, term = NULL") makes
 * this a hard REVIEW_REQUIRED regardless of every other check. */
export function classifyTermEvidence(shape: ExtractionShape, originalTermNumberWasNull: boolean): EvidenceTier {
  if (originalTermNumberWasNull) return 'DEFAULTED_NO_EVIDENCE'
  if (STRUCTURAL_SHAPES.includes(shape)) return 'STRUCTURAL'
  if (MARKER_SHAPES.includes(shape)) return 'MARKER'
  return 'AMBIENT'
}

export interface DuplicateKeyInput {
  id: string
  subjectId: string
  gradeNumber: number | null
  termNumber: number | null
  text: string
}

/** Flags records that share an identical (subject, grade, term, normalized
 * text) tuple as duplicates of the first-seen record with that key — this is
 * a much narrower key than "same topic name," so it only catches genuine
 * double-extraction (the same table cell counted twice, a repeated block
 * processed more than once), never a topic that legitimately recurs across
 * different grades/terms/subjects. Returns a map of id -> id-it-duplicates;
 * the first record of any group is never flagged. */
export function detectDuplicates(records: DuplicateKeyInput[]): Map<string, string> {
  const seen = new Map<string, string>()
  const duplicateOf = new Map<string, string>()
  for (const r of records) {
    const key = `${r.subjectId}|${r.gradeNumber}|${r.termNumber}|${normalizeForMatch(r.text)}`
    const first = seen.get(key)
    if (first) duplicateOf.set(r.id, first)
    else seen.set(key, r.id)
  }
  return duplicateOf
}

export interface ConfidenceInput {
  exactSourceTextMatch: boolean
  sourceStatus: SourceStatus
  classificationConfirmed: boolean
  gradeEvidence: EvidenceTier
  termEvidence: EvidenceTier
  reExtractionReproduced: boolean
  isDuplicate: boolean
  isRotatedSource: boolean
  isGenericFallback: boolean
  plausible: boolean
}

export interface ConfidenceResult {
  score: number
  factors: string[]
}

/**
 * Deterministic, documented weighted-sum confidence score in [0, 1]. Every
 * weight below is a fixed constant, not tuned per-record — the same inputs
 * always produce the same score. This is intentionally simple (a linear sum
 * of independent, mostly-orthogonal signals) rather than any kind of learned
 * or LLM-assigned score: the point is that a human can recompute it by hand
 * from the listed factors.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  let score = 0.1
  const factors: string[] = ['baseline_cited_source']

  if (input.exactSourceTextMatch) {
    score += 0.3
    factors.push('exact_source_text_match')
  }
  if (input.sourceStatus === 'COMPLETE') {
    score += 0.15
    factors.push('source_complete')
  }
  if (input.classificationConfirmed) {
    score += 0.15
    factors.push('classification_confirmed')
  }
  if (input.gradeEvidence === 'STRUCTURAL') {
    score += 0.15
    factors.push('grade_evidence_structural')
  } else if (input.gradeEvidence === 'MARKER') {
    score += 0.08
    factors.push('grade_evidence_marker')
  }
  if (input.termEvidence === 'STRUCTURAL' || input.termEvidence === 'MARKER') {
    score += 0.1
    factors.push('term_evidence_present')
  } else if (input.termEvidence === 'AMBIENT') {
    score += 0.03
    factors.push('term_evidence_ambient')
  } else if (input.termEvidence === 'DEFAULTED_NO_EVIDENCE') {
    score -= 0.25
    factors.push('term_defaulted_without_evidence')
  }
  if (input.reExtractionReproduced) {
    score += 0.1
    factors.push('primary_reextraction_reproduced')
  }
  if (!input.isDuplicate) {
    score += 0.1
    factors.push('no_duplicate_conflict')
  }
  if (input.isRotatedSource) {
    score -= 0.35
    factors.push('rotated_text_uncertainty')
  }
  if (input.isGenericFallback) {
    score -= 0.2
    factors.push('generic_fallback_method')
  }
  if (!input.plausible) {
    score -= 0.3
    factors.push('malformed_source_text')
  }

  return { score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)), factors }
}

export const AUTO_VERIFIED_THRESHOLD = 0.9

export interface DecisionInput extends ConfidenceInput {
  hasValidCoordinates: boolean
  duplicateOfId: string | null
}

export interface DecisionResult {
  status: ValidationStatus
  reason: string
}

/**
 * The actual gate, per the task's own 10-point checklist (section 25) plus
 * its "critical final rule" (section 48): every hard gate below is checked
 * BEFORE the numeric score is even consulted, and any gate failure returns
 * immediately with its own explicit status — the score only decides between
 * AUTO_VERIFIED and AUTO_VALIDATED once every hard gate has already passed.
 * Order matters: SOURCE_INCOMPLETE and CONFLICTING are checked first because
 * they're facts about the source/record set, not about this one record's own
 * text quality, and should never be masked by a text-quality REVIEW_REQUIRED
 * reason instead.
 */
export function decide(input: DecisionInput): DecisionResult {
  if (input.sourceStatus !== 'COMPLETE') {
    return {
      status: 'SOURCE_INCOMPLETE',
      reason: `Source document status is ${input.sourceStatus}, not COMPLETE — this record cannot be auto-verified against a source that is itself known to be incomplete for this content, regardless of how clean the extraction looks.`,
    }
  }
  if (input.duplicateOfId) {
    return {
      status: 'CONFLICTING',
      reason: `Duplicate of record ${input.duplicateOfId} — identical subject/grade/term/text also produced by this same import; needs human reconciliation before either copy is trusted.`,
    }
  }
  if (!input.classificationConfirmed) {
    return {
      status: 'NON_CURRICULUM',
      reason: 'Re-running the same classifier against the stored text no longer agrees with how this record was originally routed — likely assessment/header/table-of-contents content that should not be treated as a learner-facing curriculum topic.',
    }
  }
  if (!input.plausible) {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'Stored text fails a basic plausibility check (too short, non-alphabetic, or contains a known corruption marker) — likely a broken extraction, not genuine CAPS content.',
    }
  }
  if (input.termEvidence === 'DEFAULTED_NO_EVIDENCE') {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'The original extraction found no term for this record; the importer defaulted it to Term 1 rather than leaving it unset. That default is not source evidence, so this record cannot be auto-verified on the term it currently carries.',
    }
  }
  if (!input.exactSourceTextMatch) {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'An independent secondary extraction of the cited source page does not contain this exact text — could not confirm this record against the source.',
    }
  }
  if (input.gradeEvidence === 'AMBIENT') {
    return {
      status: 'REVIEW_REQUIRED',
      reason: 'Grade assignment for this record relies on ambient/sequential inference rather than an explicit structural marker or table column — not strong enough evidence for automatic verification.',
    }
  }

  const { score, factors } = computeConfidence(input)

  if (input.isRotatedSource) {
    return {
      status: 'AUTO_VALIDATED',
      reason: `Source text confirmed (score ${score.toFixed(2)}) but this record comes from the rotated-text table shape, which has a known, disclosed font-run character-split limitation not yet resolved — held below AUTO_VERIFIED until that limitation is fixed, per instruction not to auto-verify rotated-table text without confident reconstruction.`,
    }
  }
  if (input.isGenericFallback) {
    return {
      status: 'AUTO_VALIDATED',
      reason: `Source text confirmed (score ${score.toFixed(2)}) but this record came from the generic per-row/column fallback rather than a structural table detector, which has no header/gap validation of its own — held below AUTO_VERIFIED given that method's weaker boundary guarantees.`,
    }
  }
  if (!input.hasValidCoordinates) {
    return {
      status: 'AUTO_VALIDATED',
      reason: `All textual and structural checks pass (score ${score.toFixed(2)}), but no source bounding-box coordinates are recorded for this record — held below AUTO_VERIFIED pending a coordinate backfill match, per the coordinate-validation requirement.`,
    }
  }
  if (score >= AUTO_VERIFIED_THRESHOLD) {
    return { status: 'AUTO_VERIFIED', reason: `Confidence ${score.toFixed(2)} meets the ${AUTO_VERIFIED_THRESHOLD} threshold: ${factors.join('; ')}.` }
  }
  return {
    status: 'AUTO_VALIDATED',
    reason: `Confidence ${score.toFixed(2)} is below the ${AUTO_VERIFIED_THRESHOLD} AUTO_VERIFIED threshold; real evidence exists (${factors.join('; ')}) but not enough to auto-verify.`,
  }
}
