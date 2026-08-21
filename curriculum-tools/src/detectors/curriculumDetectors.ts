import type { ExtractedBlock } from '../parsers/types.js'

/**
 * Heuristic, regex/pattern-based detection — deliberately not a trained
 * classifier. These functions find CANDIDATE grade/subject/term/topic
 * boundaries in an extracted document; every candidate they produce becomes a
 * content_workflow_status = 'REVIEW_REQUIRED' record, never anything higher.
 * A human reviewer confirms or rejects each one against the source page shown
 * alongside it in the admin review queue (see spec section 35). Getting these
 * wrong sometimes is expected and safe; auto-publishing them would not be.
 */

export interface DetectedGrade {
  gradeNumber: number
  block: ExtractedBlock
}

export function detectGrades(blocks: ExtractedBlock[]): DetectedGrade[] {
  const found: DetectedGrade[] = []
  const pattern = /\bGRADE\s+(\d{1,2})\b/gi
  for (const block of blocks) {
    for (const match of block.text.matchAll(pattern)) {
      const gradeNumber = Number(match[1])
      if (gradeNumber >= 1 && gradeNumber <= 12) {
        found.push({ gradeNumber, block })
      }
    }
  }
  return found
}

export interface DetectedTerm {
  termNumber: number
  block: ExtractedBlock
}

export function detectTerms(blocks: ExtractedBlock[]): DetectedTerm[] {
  const found: DetectedTerm[] = []
  const pattern = /\bTERM\s+([1-4])\b/gi
  for (const block of blocks) {
    for (const match of block.text.matchAll(pattern)) {
      found.push({ termNumber: Number(match[1]), block })
    }
  }
  return found
}

export interface DetectedSubject {
  subjectName: string
  block: ExtractedBlock
}

/** Matches against the platform's own known subject names (from the DB), not
 * a hard-coded list here — so it stays correct as subjects/components change. */
export function detectSubjects(blocks: ExtractedBlock[], knownSubjectNames: string[]): DetectedSubject[] {
  const found: DetectedSubject[] = []
  for (const block of blocks) {
    if (block.type !== 'heading' && block.text.length > 60) continue
    for (const name of knownSubjectNames) {
      if (block.text.toUpperCase().includes(name.toUpperCase())) {
        found.push({ subjectName: name, block })
      }
    }
  }
  return found
}

export interface TopicCandidate {
  termNumber: number | null
  /** null when no grade marker has been seen yet, or the document has no
   * per-grade section structure (single-grade documents). Real multi-grade
   * CAPS documents (one PDF covering a whole phase) mark sections with
   * "TERM n – Grade g" — see detectGradeTermSections below — so a topic
   * candidate found after such a marker carries that specific grade, never
   * the whole phase's grade range. */
  gradeNumber: number | null
  text: string
  block: ExtractedBlock
}

// CAPS section-header formats confirmed by directly inspecting the real
// documents this platform has imported — every subject's authors used a
// different convention, so this is several specific patterns, not one:
//   - "TERM 1 – Grade 4" / "TERM 1 GRADE 4" (Mathematics, Life Skills)
//   - "GRADE 4: Term 1" (Natural Sciences & Technology amendment)
//   - "Grade 4: Intermediate Phase History Term 1" (Social Sciences —
//     arbitrary subject-name text between the grade and the term, capped
//     at 60 chars so it can't accidentally span into unrelated text)
// Deliberately NOT a single catch-all pattern: an earlier version also
// matched bare "GRADE n" and "TERM n" mentions anywhere, which broke on a
// real document — page 2 of these CAPS PDFs is a contents list formatted
// "Grade 4 Term 1", "Grade 4 Term 2" ... "Grade 6 Term 4", and each entry
// independently tripped the bare patterns, leaving front-matter mistagged
// as whatever grade+term happened to appear last in that list. Every
// pattern here was checked against each source document's front matter
// before being added, specifically to rule out that false-positive shape.
// Content before the first real match is correctly left ungraded
// (gradeNumber: null) and filtered out by the importer, rather than
// silently mislabelled — a document using a convention not listed here
// yields zero candidates, not wrong ones.
interface SectionPattern {
  regex: RegExp
  termGroup: 1 | 2
  gradeGroup: 1 | 2
}

const SECTION_PATTERNS: SectionPattern[] = [
  { regex: /\bT\s?ERM\s+([1-4])\s*[–\-—]?\s*Grade\s+(\d{1,2})\b/i, termGroup: 1, gradeGroup: 2 },
  { regex: /\bGRADE\s+(\d{1,2})\s*:\s*Term\s+([1-4])\b/i, termGroup: 2, gradeGroup: 1 },
  { regex: /\bGrade\s+(\d{1,2}):\s+.{0,60}?\bTerm\s+([1-4])\b/i, termGroup: 2, gradeGroup: 1 },
]

function matchSection(text: string): { termNumber: number; gradeNumber: number } | null {
  for (const { regex, termGroup, gradeGroup } of SECTION_PATTERNS) {
    const match = text.match(regex)
    if (match) return { termNumber: Number(match[termGroup]), gradeNumber: Number(match[gradeGroup]) }
  }
  return null
}

/**
 * Topic candidates: heading blocks, or the first column of table rows,
 * that fall between one "TERM n [– Grade g]" marker and the next. This
 * matches the common CAPS layout (a table per term/grade listing topics
 * down the first column) closely enough to be a useful starting point for
 * a reviewer — it is explicitly NOT claimed to reliably extract every topic
 * correctly. Grade tracking exists specifically so a single PDF covering an
 * entire phase (e.g. Grades 7-9 in one document) can still attribute each
 * candidate to the one specific grade its section marker named, rather than
 * the whole phase — callers are expected to filter candidates by
 * gradeNumber before writing anything (see importSource.ts's --grade flag).
 */
export function detectTopicCandidates(blocks: ExtractedBlock[]): TopicCandidate[] {
  const candidates: TopicCandidate[] = []
  let currentTerm: number | null = null
  let currentGrade: number | null = null

  for (const block of blocks) {
    const section = matchSection(block.text)
    if (section) {
      currentTerm = section.termNumber
      currentGrade = section.gradeNumber
      continue
    }

    if (block.type === 'heading' && block.text.length > 3 && block.text.length < 100) {
      candidates.push({ termNumber: currentTerm, gradeNumber: currentGrade, text: block.text, block })
      continue
    }

    if (block.type === 'table' && block.tableCells) {
      const firstColumnCells = block.tableCells.filter((c) => c.colIndex === 0 && c.rowIndex > 0)
      for (const cell of firstColumnCells) {
        if (cell.text.length > 3 && cell.text.length < 100) {
          candidates.push({ termNumber: currentTerm, gradeNumber: currentGrade, text: cell.text, block })
        }
      }
    }
  }

  return candidates
}

/**
 * Drops candidates whose exact (trimmed, case-insensitive) text repeats
 * often across the candidate set — running page headers/footers (e.g. a
 * document title reprinted on every page, like "LIFE SKILLS GRADES 4-6")
 * get harvested as heading blocks the same as real topic names, but a
 * genuine CAPS topic essentially never repeats verbatim 4+ times within one
 * document the way a running header does by construction (once per page,
 * across dozens of pages). This is a generic frequency rule, not a
 * per-document keyword list — it works the same way regardless of what the
 * actual repeated header text says.
 */
export function dropRepeatedRunningText(candidates: TopicCandidate[], threshold = 4): TopicCandidate[] {
  const counts = new Map<string, number>()
  for (const c of candidates) {
    const key = c.text.trim().toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return candidates.filter((c) => (counts.get(c.text.trim().toLowerCase()) ?? 0) < threshold)
}
