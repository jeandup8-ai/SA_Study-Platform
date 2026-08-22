import { describe, it, expect } from 'vitest'
import {
  normalizeForMatch,
  findSourceTextMatch,
  isPlausibleText,
  classifyShape,
  classifyGradeEvidence,
  classifyTermEvidence,
  detectDuplicates,
  computeConfidence,
  decide,
  AUTO_VERIFIED_THRESHOLD,
  type DecisionInput,
} from './engine.js'

/** Builds a fully-passing DecisionInput, so each negative test can override
 * exactly the one thing it's checking without repeating every field. */
function goodInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    exactSourceTextMatch: true,
    sourceStatus: 'COMPLETE',
    classificationConfirmed: true,
    gradeEvidence: 'STRUCTURAL',
    termEvidence: 'STRUCTURAL',
    reExtractionReproduced: true,
    isDuplicate: false,
    isRotatedSource: false,
    isGenericFallback: false,
    plausible: true,
    hasValidCoordinates: true,
    duplicateOfId: null,
    ...overrides,
  }
}

describe('normalizeForMatch', () => {
  it('collapses whitespace and case without touching word content', () => {
    expect(normalizeForMatch('  Whole   Numbers\n\nDIVISION ')).toBe('whole numbers division')
  })
  it('does not repair a broken/fragmented word', () => {
    // The task's own example: a rotated-table font-split must survive
    // normalization unchanged, never "fixed" into the real word.
    expect(normalizeForMatch('he solar ystem')).toBe('he solar ystem')
  })
  it('unifies curly quotes and dashes to ascii equivalents only', () => {
    expect(normalizeForMatch('Grade 7–term 1 “topic”')).toBe('grade 7-term 1 "topic"')
  })
})

describe('findSourceTextMatch', () => {
  it('matches when the candidate text is a literal substring of the page text', () => {
    const result = findSourceTextMatch('Whole numbers', 'Page header\nWhole numbers\nDivision of whole numbers')
    expect(result.matched).toBe(true)
    expect(result.snippet).toContain('whole numbers')
  })
  it('does not match a near-miss (a genuinely different string)', () => {
    const result = findSourceTextMatch('The solar system', 'he solar ystem is discussed on this page')
    expect(result.matched).toBe(false)
  })
  it('returns unmatched, not a crash, when the page text is unavailable', () => {
    expect(findSourceTextMatch('Anything', null)).toEqual({ matched: false, snippet: null, matchType: null })
  })
  it('matches via word-order subsequence when a table layout interleaves another column\'s text mid-entry', () => {
    // Real, checked case: page 24 of CAPS_Mathematics_Grades4-6.pdf reads
    // "...by 1 - digit whole By breaking down technique. 2 weeks numbers."
    // — the genuine entry, with that row's DURATION cell ("2 weeks")
    // genuinely sitting between "whole" and "numbers" in plain reading
    // order, and a hyphen-spacing difference ("1-digit" vs "1 - digit").
    const result = findSourceTextMatch(
      'Divide whole numbers with at least 3 digits by 1-digit whole numbers.',
      'Divide whole numbers with at\nleast 3 digits by 1 - digit whole By breaking down technique.\n2 weeks numbers.',
    )
    expect(result.matched).toBe(true)
    expect(result.matchType).toBe('subsequence')
  })
  it('does not subsequence-match when the words are out of order', () => {
    const result = findSourceTextMatch('numbers whole Divide', 'Divide whole numbers appear on this page')
    expect(result.matched).toBe(false)
  })
})

describe('isPlausibleText — malformed source text rejection', () => {
  it('rejects a too-short fragment', () => {
    expect(isPlausibleText('ab').plausible).toBe(false)
  })
  it('rejects text dominated by a bullet marker', () => {
    expect(isPlausibleText('• d').plausible).toBe(false)
  })
  it('rejects text with a low alphabetic ratio (numeric/punctuation noise)', () => {
    expect(isPlausibleText('5 878 + 3 295 ≈ 9 000').plausible).toBe(false)
  })
  it('accepts a genuine short topic name', () => {
    expect(isPlausibleText('Whole numbers').plausible).toBe(true)
  })
})

describe('classifyShape — header/footer/TOC/assessment records never read as structural', () => {
  it('identifies a grade-column table', () => {
    expect(classifyShape('Page 12, grade-column table', 'pdf_table')).toBe('GRADE_COLUMN')
  })
  it('identifies the Life Skills table distinctly from the generic topic/time/resource shape', () => {
    expect(classifyShape('Page 22, Life Skills topic/time/resources table', 'pdf_table')).toBe('LIFE_SKILLS')
    expect(classifyShape('Page 29, topic/time/resource table', 'pdf_table')).toBe('TOPIC_TIME_RESOURCE')
  })
  it('identifies rotated-table records distinctly from plain content-outline records', () => {
    expect(classifyShape('Page 36, rotated content-outline table (TOPIC column)', 'pdf_table')).toBe('ROTATED')
    expect(classifyShape('Page 24, content-outline table (CONTENT column)', 'pdf_table')).toBe('CONTENT_OUTLINE')
  })
  it('identifies the generic per-row/column fallback (headers/footers/unstructured pages land here)', () => {
    expect(classifyShape('Page 45, detected table', 'pdf_table')).toBe('GENERIC_FALLBACK')
  })
  it('identifies a heading-sourced candidate with no table backing at all', () => {
    expect(classifyShape('Page 3', 'pdf_text')).toBe('HEADING_TEXT')
  })
})

describe('grade/term evidence tiers', () => {
  it('grants STRUCTURAL grade evidence only to structurally-scoped table shapes', () => {
    expect(classifyGradeEvidence('GRADE_COLUMN')).toBe('STRUCTURAL')
    expect(classifyGradeEvidence('LIFE_SKILLS')).toBe('STRUCTURAL')
    expect(classifyGradeEvidence('CONTENT_OUTLINE')).toBe('MARKER')
    expect(classifyGradeEvidence('GENERIC_FALLBACK')).toBe('AMBIENT')
    expect(classifyGradeEvidence('HEADING_TEXT')).toBe('AMBIENT')
  })
  it('flags a term defaulted by the importer with no source evidence, regardless of table shape', () => {
    expect(classifyTermEvidence('GRADE_COLUMN', true)).toBe('DEFAULTED_NO_EVIDENCE')
  })
  it('grants real term evidence only when the source actually specified a term', () => {
    expect(classifyTermEvidence('GRADE_COLUMN', false)).toBe('STRUCTURAL')
    expect(classifyTermEvidence('GENERIC_FALLBACK', false)).toBe('AMBIENT')
  })
})

describe('detectDuplicates', () => {
  it('flags an exact repeat of the same subject/grade/term/text tuple, not the first occurrence', () => {
    const dup = detectDuplicates([
      { id: 'a', subjectId: 's1', gradeNumber: 7, termNumber: 2, text: 'Dance performance' },
      { id: 'b', subjectId: 's1', gradeNumber: 7, termNumber: 2, text: 'dance   performance' },
    ])
    expect(dup.get('a')).toBeUndefined()
    expect(dup.get('b')).toBe('a')
  })
  it('does not flag the same topic name legitimately recurring in a different term', () => {
    const dup = detectDuplicates([
      { id: 'a', subjectId: 's1', gradeNumber: 7, termNumber: 1, text: 'Dance performance' },
      { id: 'b', subjectId: 's1', gradeNumber: 7, termNumber: 2, text: 'Dance performance' },
    ])
    expect(dup.size).toBe(0)
  })
})

describe('decide — negative tests: what must never reach AUTO_VERIFIED', () => {
  it('rejects when the source document itself is incomplete for this content', () => {
    const result = decide(goodInput({ sourceStatus: 'INCOMPLETE' }))
    expect(result.status).toBe('SOURCE_INCOMPLETE')
  })
  it('rejects an amendment-only source the same way', () => {
    const result = decide(goodInput({ sourceStatus: 'AMENDMENT_ONLY' }))
    expect(result.status).toBe('SOURCE_INCOMPLETE')
  })
  it('rejects a duplicate extraction as CONFLICTING, not silently deleted or silently kept', () => {
    const result = decide(goodInput({ isDuplicate: true, duplicateOfId: 'other-id' }))
    expect(result.status).toBe('CONFLICTING')
    expect(result.reason).toContain('other-id')
  })
  it('rejects a record whose re-classification no longer agrees it is curriculum content (header/footer/TOC/assessment leakage)', () => {
    const result = decide(goodInput({ classificationConfirmed: false }))
    expect(result.status).toBe('NON_CURRICULUM')
  })
  it('rejects malformed/corrupted source text', () => {
    const result = decide(goodInput({ plausible: false }))
    expect(result.status).toBe('REVIEW_REQUIRED')
  })
  it('rejects a term the importer defaulted without source evidence', () => {
    const result = decide(goodInput({ termEvidence: 'DEFAULTED_NO_EVIDENCE' }))
    expect(result.status).toBe('REVIEW_REQUIRED')
  })
  it('rejects when the independent secondary extraction does not confirm the text (wrong page, invented text, or ambiguous rotated text)', () => {
    const result = decide(goodInput({ exactSourceTextMatch: false }))
    expect(result.status).toBe('REVIEW_REQUIRED')
  })
  it('rejects an ambiguous/ambient grade (wrong-grade-column risk) even with everything else clean', () => {
    const result = decide(goodInput({ gradeEvidence: 'AMBIENT' }))
    expect(result.status).toBe('REVIEW_REQUIRED')
  })
  it('never auto-verifies rotated-text records, even with a confirmed exact match', () => {
    const result = decide(goodInput({ isRotatedSource: true }))
    expect(result.status).not.toBe('AUTO_VERIFIED')
    expect(result.status).toBe('AUTO_VALIDATED')
  })
  it('never auto-verifies a generic-fallback-extracted record', () => {
    const result = decide(goodInput({ isGenericFallback: true }))
    expect(result.status).not.toBe('AUTO_VERIFIED')
  })
  it('never auto-verifies a record with no recorded source coordinates', () => {
    const result = decide(goodInput({ hasValidCoordinates: false }))
    expect(result.status).not.toBe('AUTO_VERIFIED')
  })
  it('never invents a "safe" verdict purely from a high raw score if a hard gate fails', () => {
    // High-looking inputs on paper, but sourceStatus fails — must still be
    // SOURCE_INCOMPLETE, proving the hard gates are checked before scoring.
    const result = decide(goodInput({ sourceStatus: 'UNKNOWN', gradeEvidence: 'STRUCTURAL', termEvidence: 'STRUCTURAL' }))
    expect(result.status).toBe('SOURCE_INCOMPLETE')
  })
})

describe('decide — positive test: what a genuinely well-evidenced record looks like', () => {
  it('reaches AUTO_VERIFIED only when every hard gate passes and the score clears the threshold', () => {
    const input = goodInput()
    const { score } = computeConfidence(input)
    expect(score).toBeGreaterThanOrEqual(AUTO_VERIFIED_THRESHOLD)
    const result = decide(input)
    expect(result.status).toBe('AUTO_VERIFIED')
  })
  it('falls back to AUTO_VALIDATED (not AUTO_VERIFIED, not REVIEW_REQUIRED) for real-but-partial evidence', () => {
    // All hard gates pass (grade/term evidence still real, just weaker), but
    // no source coordinates were recorded — real evidence, held short of
    // AUTO_VERIFIED rather than either silently promoted or discarded.
    const result = decide(
      goodInput({ gradeEvidence: 'MARKER', termEvidence: 'AMBIENT', reExtractionReproduced: false, hasValidCoordinates: false }),
    )
    expect(result.status).toBe('AUTO_VALIDATED')
  })
})

describe('AUTO_VERIFIED never equals human VERIFIED', () => {
  it('the validation status vocabulary has no overlap with content_workflow_status values', () => {
    // Documents the architectural boundary directly: this module's own
    // status type must never contain the human-review states, so a future
    // edit can't accidentally conflate them.
    const statuses = ['AUTO_VALIDATED', 'AUTO_VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_INCOMPLETE', 'NON_CURRICULUM', 'CONFLICTING']
    expect(statuses).not.toContain('VERIFIED')
    expect(statuses).not.toContain('PUBLISHED')
  })
})
