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
  text: string
  block: ExtractedBlock
}

/**
 * Topic candidates: heading blocks, or the first column of table rows,
 * that fall between one "TERM n" marker and the next. This matches the
 * common CAPS ATP layout (a table per term listing topics down the first
 * column) closely enough to be a useful starting point for a reviewer —
 * it is explicitly NOT claimed to reliably extract every topic correctly.
 */
export function detectTopicCandidates(blocks: ExtractedBlock[]): TopicCandidate[] {
  const candidates: TopicCandidate[] = []
  let currentTerm: number | null = null
  const termPattern = /\bTERM\s+([1-4])\b/i

  for (const block of blocks) {
    const termMatch = block.text.match(termPattern)
    if (termMatch) {
      currentTerm = Number(termMatch[1])
      continue
    }

    if (block.type === 'heading' && block.text.length > 3 && block.text.length < 100) {
      candidates.push({ termNumber: currentTerm, text: block.text, block })
      continue
    }

    if (block.type === 'table' && block.tableCells) {
      const firstColumnCells = block.tableCells.filter((c) => c.colIndex === 0 && c.rowIndex > 0)
      for (const cell of firstColumnCells) {
        if (cell.text.length > 3 && cell.text.length < 100) {
          candidates.push({ termNumber: currentTerm, text: cell.text, block })
        }
      }
    }
  }

  return candidates
}
