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
  /** 'pdf_table' when this candidate came from a table cell (structural or
   * generic-fallback), 'pdf_text' for a heading — the two extraction paths
   * this pipeline actually has (see Priority 5's source-traceability spec). */
  extractionMethod: 'pdf_table' | 'pdf_text'
  /** In [0, 1]. Table cells from a structural detector (content-outline,
   * grade-column, topic/time/resource) carry their own calibrated value
   * (see columnTables.ts); the generic fallback table detector and every
   * heading candidate don't have one to inherit, so they get a fixed,
   * deliberately mid-range default (0.6) — lower than any structural
   * detector's minimum (0.75), reflecting that neither path can verify its
   * own boundaries the way a structural detector's gap/header logic can. */
  confidenceScore: number
}

const GENERIC_TABLE_CONFIDENCE = 0.6
const HEADING_CONFIDENCE = 0.6

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
 * Priority 4's classification layer: every block a candidate could come
 * from is checked against known non-curriculum shapes BEFORE it's treated
 * as a topic. Only ASSESSMENT_GUIDANCE/ASSESSMENT_APPENDIX and
 * TABLE_OF_CONTENTS are distinguished here — the finer LEARNING_OBJECTIVE/
 * CONTENT/SKILL split from the spec doesn't apply yet, since this pipeline
 * doesn't extract those as separate entities from a CAPS PDF (only topic
 * names); HEADER/FOOTER noise is handled by dropRepeatedRunningText and
 * dropKnownBoilerplate below, which operate on the candidate stream instead
 * of block text, since running headers are only reliably identifiable by
 * their repetition frequency, not by wording alone.
 */
export type BlockCategory = 'CURRICULUM_TOPIC' | 'ASSESSMENT_GUIDANCE' | 'ASSESSMENT_APPENDIX' | 'TABLE_OF_CONTENTS'

// Calibrated against a real false-positive found in Social Sciences
// Grades 4-6: pages 42-44 carry a "Formal assessments | Year %" assessment
// PROGRAMME table whose first column reads like real topic names (e.g.
// "An African kingdom long ago... Mapungubwe") because it's literally
// listing which topic each formal assessment task covers — structurally
// identical to a genuine content table, so only its own wording gives it
// away. Kept to specific multi-word phrases, not a bare "assessment", since
// a genuine content-outline table legitimately has cells like "Revision,
// Assessment and Feedback" (a real recurring lesson-pacing entry, not
// noise) that a looser pattern would have wrongly swept up too.
// The Natural Sciences & Technology Grades 4-6 amendment carries a second,
// differently-worded assessment table (checked against real output —
// "Form of ... Task/Test", "Tools of assessment", "Minimum Marks", "No. of
// Tasks" as column labels), so the pattern needs both wordings, not just
// the Social Sciences one.
const ASSESSMENT_GUIDANCE_PATTERN =
  /\b(formal assessments?|continuous assessment|year-end examination|programme of assessment|assessment programme|school-based assessment|\bSBA\b|mark allocation|tools of assessment|minimum marks|no\.? of tasks|form of (?:.{0,20}\s)?task)\b/i
const ASSESSMENT_APPENDIX_PATTERN = /\b(annexure|appendix)\b/i
const TABLE_OF_CONTENTS_PATTERN = /^(table of )?contents$/i

// Real CAPS documents mark their assessment section with a heading like
// "SECTION 4: ASSESSMENT" (checked against Creative Arts and Life Skills'
// real front matter/section headings) — once seen, everything after it is
// assessment content, used as a stronger fallback than per-text keyword
// matching (see detectTopicCandidates' inAssessmentSection).
// Mathematics (both Grades 4-6 and 7-9) uses "CHAPTER" instead of "SECTION"
// for the same document structure — checked against real output, its own
// assessment section splits into a bare "CHAPTER 4" heading followed by a
// separate "(ASSESSMENT)" block, the same split-heading shape Life Skills
// uses with "SECTION 4" / "ASSESSMENT IN LIFE SKILLS".
const ASSESSMENT_SECTION_MARKER_PATTERN = /\b(?:SECTION|CHAPTER)\s+\d+\s*[:.]?\s*\(?ASSESSMENT\)?\b/i
// A bare "SECTION 4" / "CHAPTER 4" heading, with the word "Assessment"
// arriving as a separate following block, is a real second convention
// (checked against Life Skills Grades 4-6's actual pages: "SECTION 4" is
// its own heading, "ASSESSMENT IN LIFE SKILLS" a separate paragraph right
// after it — a font-size split, not a wording difference; Mathematics does
// the same with "CHAPTER 4" / "(ASSESSMENT)"). Every CAPS document sampled
// so far uses section/chapter 4 for assessment specifically, so a bare
// "SECTION 4"/"CHAPTER 4" is trusted as the same signal on its own.
const BARE_SECTION_4_PATTERN = /^(?:SECTION|CHAPTER)\s+4\.?$/i

export function classifyBlock(block: ExtractedBlock): BlockCategory {
  const text = block.text.trim()
  if (TABLE_OF_CONTENTS_PATTERN.test(text)) return 'TABLE_OF_CONTENTS'
  if (ASSESSMENT_APPENDIX_PATTERN.test(text)) return 'ASSESSMENT_APPENDIX'
  if (ASSESSMENT_GUIDANCE_PATTERN.test(text)) return 'ASSESSMENT_GUIDANCE'
  return 'CURRICULUM_TOPIC'
}

export interface AssessmentNote {
  category: 'ASSESSMENT_GUIDANCE' | 'ASSESSMENT_APPENDIX'
  termNumber: number | null
  gradeNumber: number | null
  text: string
  block: ExtractedBlock
  extractionMethod: 'pdf_table' | 'pdf_text'
  confidenceScore: number
}

export interface TopicDetectionResult {
  topics: TopicCandidate[]
  /** Assessment-related text this same pass turned up — real source
   * content, kept (per the spec's explicit instruction) rather than
   * discarded, but never inserted as a topics row: it isn't curriculum
   * content a learner should see as something to study, it's guidance
   * about how the subject is assessed. */
  assessmentNotes: AssessmentNote[]
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
 *
 * Each block is classified (see classifyBlock) before being read as a
 * topic: a block whose own wording marks it as an assessment programme/
 * appendix table is diverted into assessmentNotes instead, at the whole
 * block's granularity (not filtered cell-by-cell) — the real assessment
 * programme table found in this project's source pack is entirely
 * assessment content end to end, not a mix, so block-level classification
 * is both simpler and accurate for the shape actually observed.
 */
export function detectTopicCandidates(blocks: ExtractedBlock[]): TopicDetectionResult {
  const topics: TopicCandidate[] = []
  const assessmentNotes: AssessmentNote[] = []
  let currentTerm: number | null = null
  let currentGrade: number | null = null
  // Once a document's own "SECTION n: ASSESSMENT" heading is seen, every
  // remaining candidate is treated as assessment content regardless of its
  // own wording — checked against real data (Natural Sciences & Technology
  // Grades 4-6), a Bloom's-taxonomy cognitive-verb glossary ("recall",
  // "select", "trace"...) and assessment-table fragments ("Tools of",
  // "Time Allocation") in that section carry no assessment keyword of their
  // own at all, so per-text classification alone can't catch them; the
  // document's own section boundary is a stronger, more general signal.
  // Real CAPS assessment sections are always the last section (nothing
  // returns to real content afterward), so this deliberately never resets.
  let inAssessmentSection = false

  for (const block of blocks) {
    const section = matchSection(block.text)
    if (section) {
      currentTerm = section.termNumber
      currentGrade = section.gradeNumber
      continue
    }
    // The dot-leader check matters: checked against real data, Life Skills'
    // table of contents has an entry "SECTION 4: ASSESSMENT IN LIFE
    // SKILLS ....................... 51" that would otherwise match this
    // same pattern on page 6 and flip inAssessmentSection on for 45+ pages
    // too early, wiping out every real topic in the whole document. A ToC
    // entry always carries a run of dot-leader characters before its page
    // number; a genuine section heading never does — this is a more direct
    // distinguisher than a length cutoff, which broke when this same marker
    // showed up inside a full joined table block's text (much longer than a
    // plain heading, but still a genuine section start, not a ToC line).
    if (
      (BARE_SECTION_4_PATTERN.test(block.text.trim()) ||
        (ASSESSMENT_SECTION_MARKER_PATTERN.test(block.text) && !/\.{4,}/.test(block.text)))
    ) {
      inAssessmentSection = true
      continue
    }

    if (block.type === 'heading' && block.text.length > 3 && block.text.length < 100) {
      const category = inAssessmentSection ? 'ASSESSMENT_GUIDANCE' : classifyBlock(block)
      if (category === 'TABLE_OF_CONTENTS') continue
      if (category === 'CURRICULUM_TOPIC') {
        topics.push({
          termNumber: currentTerm,
          gradeNumber: currentGrade,
          text: block.text,
          block,
          extractionMethod: 'pdf_text',
          confidenceScore: HEADING_CONFIDENCE,
        })
      } else {
        assessmentNotes.push({
          category,
          termNumber: currentTerm,
          gradeNumber: currentGrade,
          text: block.text,
          block,
          extractionMethod: 'pdf_text',
          confidenceScore: HEADING_CONFIDENCE,
        })
      }
      continue
    }

    if (block.type === 'table' && block.tableCells) {
      // Every column OTHER than the first, not the whole block's joined
      // text, decides whether the WHOLE table is assessment-programme
      // content — checked against real data, this needs to be narrower than
      // "the whole block": a Creative Arts table genuinely combines several
      // independent topics into one block (see extractTopicTimeResourceTable),
      // and one topic legitimately being named "... Formal assessment
      // Project (3 stages)" doesn't make its neighbours "dance performance"
      // or "Create in 2d" assessment content too — classifying by the whole
      // joined block text wrongly threw all of them out together, and it
      // turned out classifying by rowIndex 0 alone wasn't reliable either
      // (checked against real data: the assessment-programme table's own
      // "Formal assessments | Year %" column labels didn't all land in row
      // 0). The real assessment-programme table this catches (Social
      // Sciences Grades 4-6, pages 42-44) always carries its assessment
      // scaffolding — percentages, "Formal assessments", "Year %" — in
      // columns other than the first, since the first column is always the
      // topic-name column in every table shape this pipeline reads; every
      // structural detector in this file only ever emits colIndex 0 (no
      // other columns at all), so a table with nothing in another column
      // correctly falls through to per-cell classification below.
      // A positive signal here (anything but the CURRICULUM_TOPIC default)
      // escalates every cell in the table — but a table whose other columns
      // happen not to carry the tell-tale wording must NOT force every cell
      // to CURRICULUM_TOPIC either: checked against real data (Natural
      // Sciences & Technology Grades 4-6's assessment table, whose own
      // signal cells — "Minimum Marks", "No. of Tasks" — sit in colIndex 0
      // of their own row, since the generic fallback table detector's
      // colIndex is relative to each row independently, not one stable
      // table-wide column). Only treat a real ASSESSMENT_*/TOC signal as
      // decisive; otherwise fall through to per-cell classification so
      // those colIndex-0 signal cells still get read correctly below.
      const otherColumnCells = block.tableCells.filter((c) => c.colIndex !== 0)
      const wholeTableSignal =
        otherColumnCells.length > 0
          ? classifyBlock({ ...block, text: otherColumnCells.map((c) => c.text).join(' ') })
          : null
      const tableCategory = inAssessmentSection
        ? 'ASSESSMENT_GUIDANCE'
        : wholeTableSignal && wholeTableSignal !== 'CURRICULUM_TOPIC'
          ? wholeTableSignal
          : null
      if (tableCategory === 'TABLE_OF_CONTENTS') continue

      const firstColumnCells = block.tableCells.filter((c) => c.colIndex === 0 && c.rowIndex > 0)
      for (const cell of firstColumnCells) {
        if (cell.text.length <= 3 || cell.text.length >= 200) continue
        // A cell from a structural grade-column table already knows its
        // own grade/term from the table layout itself (see
        // gradeColumnRowsToTableCells) — more reliable than ambient
        // section-marker state, which doesn't apply to this table shape
        // at all (there is no preceding "TERM n – Grade g" text for it).
        const gradeNumber = cell.gradeNumber !== undefined ? cell.gradeNumber : currentGrade
        const termNumber = cell.termNumber !== undefined ? cell.termNumber : currentTerm
        const category = tableCategory ?? classifyBlock({ ...block, text: cell.text })
        if (category === 'TABLE_OF_CONTENTS') continue
        const confidenceScore = cell.confidence ?? GENERIC_TABLE_CONFIDENCE
        if (category === 'CURRICULUM_TOPIC') {
          if (cell.text.length < 100) {
            topics.push({ termNumber, gradeNumber, text: cell.text, block, extractionMethod: 'pdf_table', confidenceScore })
          }
        } else {
          assessmentNotes.push({
            category,
            termNumber,
            gradeNumber,
            text: cell.text,
            block,
            extractionMethod: 'pdf_table',
            confidenceScore,
          })
        }
      }
    }
  }

  return { topics, assessmentNotes }
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
/**
 * Every real CAPS document sampled in this project's source pack repeats
 * the same footer boilerplate ("Curriculum and Assessment Policy Statement
 * (CAPS) – <Subject>: <Phase>") on nearly every page. dropRepeatedRunningText
 * usually filters this out, but the exact wording sometimes varies slightly
 * page to page (different wrap points), which defeats an exact-match
 * frequency count. This is a second, structural filter for the same known
 * boilerplate shape — not a per-document content list — kept narrow enough
 * that it can't accidentally match a genuine topic name (a real CAPS topic
 * never starts with "(CAPS)" or contains this exact policy-document title).
 */
const BOILERPLATE_PATTERNS = [/^\(?caps\)?\s*[–-]/i, /curriculum and assessment policy statement/i]

export function dropKnownBoilerplate(candidates: TopicCandidate[]): TopicCandidate[] {
  return candidates.filter((c) => !BOILERPLATE_PATTERNS.some((p) => p.test(c.text.trim())))
}

/**
 * Only heading-type candidates are checked against the frequency threshold.
 * A running header/footer always arrives here as a heading block (this
 * pipeline's font-size-outlier heading detector fires on the same
 * document-title text reprinted at the top of every page) — a structural
 * table cell never is one. That distinction matters because a genuine CAPS
 * topic name CAN legitimately repeat exactly 4 times without being noise:
 * Creative Arts' Section 3 repeats the same topic name (e.g. "Dance
 * performance") once per term, so a Grade 7 subject taught across 4 terms
 * produces exactly 4 identical table-cell candidates — coincidentally
 * exactly this function's old threshold, and a real check against real
 * output confirmed the untargeted version was silently dropping these as
 * if they were boilerplate. Excluding table-origin candidates from the
 * frequency check entirely removes that false-positive path rather than
 * papering over it with a higher threshold.
 */
export function dropRepeatedRunningText(candidates: TopicCandidate[], threshold = 4): TopicCandidate[] {
  const counts = new Map<string, number>()
  for (const c of candidates) {
    if (c.block.type !== 'heading') continue
    const key = c.text.trim().toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return candidates.filter(
    (c) => c.block.type !== 'heading' || (counts.get(c.text.trim().toLowerCase()) ?? 0) < threshold,
  )
}
