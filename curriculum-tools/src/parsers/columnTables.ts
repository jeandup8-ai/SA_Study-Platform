import type { ExtractedTableCell } from './types.js'

/**
 * Structured, geometry-aware table reading for the two real CAPS table
 * shapes found in this project's source pack that the generic row/column
 * heuristic in pdfParser.ts cannot read correctly:
 *
 *   1. "Content outline" tables (CONTENT AREA | CONTENT | CLARIFICATION OR
 *      NOTES | DURATION) — a real, standard DBE table header used across
 *      several CAPS subjects. Its cells wrap across many lines each, and
 *      different columns wrap to different numbers of lines independently,
 *      so a single global row-grouping-by-y (what pdfParser.ts's generic
 *      path does) never lines the columns up — most "rows" it finds only
 *      contain one column's text, so the page never crosses the
 *      multi-column-row threshold and everything falls through as
 *      unstructured paragraphs. This detector instead finds the header's
 *      column x-positions, bins every item below it into the nearest
 *      column, and reconstructs each column's own entries independently
 *      using a gap-based line-merge (calibrated against real pages: wrapped
 *      continuation lines of the same entry sit ~10-13pt apart, distinct
 *      entries ~35pt+ apart).
 *
 *   2. "Grade-as-column" tables (a header row of "Grade 7 | Grade 8 |
 *      Grade 9", one column per grade, one row per term) — used in the
 *      Human & Social Sciences document's content-overview summary. Here
 *      the grade a cell belongs to comes directly from which column it's
 *      in, not from a preceding text marker, so results carry an explicit
 *      gradeNumber/termNumber rather than relying on ambient section state.
 *
 * Both are real geometric reconstruction, not text concatenation — every
 * cell keeps its originating page and the row/column region it was read
 * from, and both flag exactly this in confidence: cleanly-gapped entries
 * score higher than ambiguous ones. Nothing here decides these cells are
 * curriculum topics; that's still detectTopicCandidates' and
 * classifyBlock's job downstream, and everything still lands in
 * REVIEW_REQUIRED regardless of confidence.
 */

export interface TextItem {
  str: string
  x: number
  y: number
  width: number
}

interface ColumnBound {
  label: string
  xMin: number
  xMax: number
  /** The matched header label's own x-position, before any boundary
   * widening — useful when a column's derived xMin/xMax range is too wide
   * to trust for something that needs the header's exact position (e.g.
   * finding a narrow row-anchor column's own values, not everything within
   * its full allotted width). */
  headerX: number
}

const LINE_Y_TOLERANCE = 2 // points; items within this are the same visual line
/** Calibrated against real Mathematics Grade 7-9 pages: a wrapped
 * continuation line of the same entry sits ~10-13pt below the previous
 * line; a genuinely new entry sits ~35pt+ below. 20pt cleanly separates
 * the two without being tuned to one specific page's exact numbers. */
const SAME_ENTRY_MAX_GAP = 20

/** Several CAPS documents (Creative Arts confirmed) render a word's first
 * letter in a distinct font run from the rest of the word — pdfjs then
 * reports it as two separate text items with a real x-gap of ~0, e.g. a
 * "d" item ending exactly where an "ance in Grade 7" item begins. Blindly
 * joining every same-line item with a space turns this into "d ance in
 * Grade 7", corrupting every topic name it touches. Checked against a
 * 2256-gap sample from that document: genuine mid-word splits cluster at
 * 0-1.8pt gaps, real inter-word spaces start at 2.0pt+ with a clean break
 * between the two — so a gap under 1.9pt means "same word, no space",
 * anything wider gets a space. */
const WORD_SPLIT_GAP_THRESHOLD = 1.9

export function joinTextItems(items: { x: number; width: number; str: string }[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  let text = ''
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].width)
      if (gap > WORD_SPLIT_GAP_THRESHOLD) text += ' '
    }
    text += sorted[i].str
  }
  return text.replace(/\s+/g, ' ').trim()
}

interface WordChunk {
  text: string
  x: number
}

/** Merges same-line items into word-level chunks using the same
 * split-vs-space gap rule as joinTextItems, so header-label matching sees
 * "topic 1" as one chunk rather than the raw "t" / "opic 1" pdfjs items a
 * font-driven mid-word split produces. Real CAPS header labels this project
 * has matched against so far (Grade 7, CONTENT, Term) already arrive as a
 * single item and pass through unchanged — this only changes behaviour for
 * documents that actually have the split. */
function mergeWordChunks(rowItems: TextItem[]): WordChunk[] {
  const sorted = [...rowItems].sort((a, b) => a.x - b.x)
  const chunks: { text: string; x: number; endX: number }[] = []
  for (const it of sorted) {
    const prev = chunks[chunks.length - 1]
    if (prev && it.x - prev.endX <= WORD_SPLIT_GAP_THRESHOLD) {
      prev.text += it.str
      prev.endX = Math.max(prev.endX, it.x + it.width)
    } else {
      chunks.push({ text: it.str, x: it.x, endX: it.x + it.width })
    }
  }
  return chunks.map((c) => ({ text: c.text.replace(/\s+/g, ' ').trim(), x: c.x }))
}

function groupIntoLines(items: TextItem[]): { y: number; x: number; text: string }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: TextItem[][] = []
  for (const item of sorted) {
    const current = lines[lines.length - 1]
    if (current && Math.abs(current[0].y - item.y) <= LINE_Y_TOLERANCE) current.push(item)
    else lines.push([item])
  }
  return lines.map((line) => ({
    y: line[0].y,
    x: Math.min(...line.map((i) => i.x)),
    text: joinTextItems(line),
  }))
}

/** Same word-split-aware joining as joinTextItems, but across a whole
 * multi-line region (top-to-bottom, then left-to-right within each line) —
 * for callers reconstructing a block of running text rather than one line,
 * e.g. pdfParser.ts's "text sitting above a table header" block. */
export function joinMultilineText(items: TextItem[]): string {
  return groupIntoLines(items)
    .map((l) => l.text)
    .join(' ')
    .trim()
}

/**
 * Finds a header row (items at the same y) whose distinct texts match every
 * label pattern supplied. Column boundaries are NOT the midpoint between
 * header label x-positions — checked against real data and confirmed wrong:
 * a header can be centred/padded well to the right of where its column's
 * actual body text starts (e.g. this project's Mathematics CAPS document
 * has a "CONTENT" header at x≈194 but that column's real paragraphs start
 * at x≈167, and "CLARIFICATION" at x≈444 while its column's text starts at
 * x≈283) — a header-midpoint boundary silently swallows the next column's
 * start into the previous one. A first attempt at fixing this with k-means
 * clustering on body-text x-positions also failed: k-means assumes roughly
 * equal-sized, well-separated clusters, but a CLARIFICATION column has far
 * more wrapped lines than a CONTENT column of short topic labels, and that
 * imbalance dragged centroids into the wrong basin.
 *
 * What actually works, checked against real sorted line-start x-values on
 * this exact page: the true column boundaries sit at the LARGEST GAPS in
 * that sorted list (85-400pt gaps between columns vs. a few points within
 * one column's own left-margin variance) — not a clustering problem, a gap
 * problem. Boundaries are the midpoints of the (columnCount - 1) largest
 * gaps in the sorted, deduplicated list of body line-start x-positions.
 */
export function detectHeaderRow(
  items: TextItem[],
  labelPatterns: RegExp[],
): { columns: ColumnBound[]; headerY: number } | null {
  const lines = groupIntoLines(items)
  for (const line of lines) {
    // A header row's own items, not the merged line text: re-derive
    // word-level chunks at this y so we get per-label x, not one blob (and
    // so a font-driven mid-word split, e.g. "t" / "opic" as separate pdfjs
    // items, still matches a "topic" label pattern — see mergeWordChunks).
    const rowItems = items.filter((it) => Math.abs(it.y - line.y) <= LINE_Y_TOLERANCE)
    const chunks = mergeWordChunks(rowItems)
    const matches: { label: string; x: number }[] = []
    for (const pattern of labelPatterns) {
      const hit = chunks.find((c) => pattern.test(c.text))
      if (!hit) break
      matches.push({ label: hit.text, x: hit.x })
    }
    if (matches.length !== labelPatterns.length) continue
    matches.sort((a, b) => a.x - b.x)

    const bodyLines = groupIntoLines(items.filter((it) => it.y < line.y))
    const boundaries = gapBasedBoundaries(
      bodyLines.map((l) => l.x),
      matches.map((m) => m.x),
      matches.length - 1,
    )
    const columns: ColumnBound[] = matches.map((m, i) => ({
      label: m.label,
      xMin: i === 0 ? -Infinity : boundaries[i - 1],
      xMax: i === matches.length - 1 ? Infinity : boundaries[i],
      headerX: m.x,
    }))
    return { columns, headerY: line.y }
  }
  return null
}

/**
 * Like detectHeaderRow, but returns every matching header row on the page
 * instead of stopping at the first. Needed for CAPS layouts that repeat the
 * same mini-table header once per topic on a page — e.g. Creative Arts'
 * Section 3 term plans repeat "Topic N | Suggested contact time |
 * Recommended resources" 2-3 times per page, one per topic, and every
 * occurrence has real Grade 7 content the caller needs, not just the first.
 */
export function detectAllHeaderRows(
  items: TextItem[],
  labelPatterns: RegExp[],
): { columns: ColumnBound[]; headerY: number }[] {
  const results: { columns: ColumnBound[]; headerY: number }[] = []
  const lines = groupIntoLines(items)
  for (const line of lines) {
    const rowItems = items.filter((it) => Math.abs(it.y - line.y) <= LINE_Y_TOLERANCE)
    const chunks = mergeWordChunks(rowItems)
    const matches: { label: string; x: number }[] = []
    for (const pattern of labelPatterns) {
      const hit = chunks.find((c) => pattern.test(c.text))
      if (!hit) break
      matches.push({ label: hit.text, x: hit.x })
    }
    if (matches.length !== labelPatterns.length) continue
    matches.sort((a, b) => a.x - b.x)

    const bodyLines = groupIntoLines(items.filter((it) => it.y < line.y))
    const boundaries = gapBasedBoundaries(
      bodyLines.map((l) => l.x),
      matches.map((m) => m.x),
      matches.length - 1,
    )
    const columns: ColumnBound[] = matches.map((m, i) => ({
      label: m.label,
      xMin: i === 0 ? -Infinity : boundaries[i - 1],
      xMax: i === matches.length - 1 ? Infinity : boundaries[i],
      headerX: m.x,
    }))
    results.push({ columns, headerY: line.y })
  }
  return results
}

/** For each adjacent pair of header x-positions, finds the largest gap
 * between sorted body-text x-values that falls strictly between that pair
 * — not the largest gap on the whole page, which can belong to an entirely
 * different, unrelated column (e.g. a far-right DURATION column not even
 * part of this header set) and would corrupt every boundary if chosen
 * globally. Falls back to the header-position midpoint when no body text
 * falls between a given pair at all (a genuinely empty column on this
 * page). */
function gapBasedBoundaries(xs: number[], headerXs: number[], count: number): number[] {
  const sorted = [...new Set(xs.map((x) => Math.round(x * 10) / 10))].sort((a, b) => a - b)
  const boundaries: number[] = []
  for (let i = 0; i < count; i++) {
    const lo = headerXs[i]
    const hi = headerXs[i + 1]
    const inRange = sorted.filter((x) => x >= lo && x <= hi)
    if (inRange.length < 2) {
      boundaries.push((lo + hi) / 2)
      continue
    }
    let bestGap = -1
    let bestMid = (lo + hi) / 2
    for (let j = 1; j < inRange.length; j++) {
      const gap = inRange[j] - inRange[j - 1]
      if (gap > bestGap) {
        bestGap = gap
        bestMid = (inRange[j - 1] + inRange[j]) / 2
      }
    }
    boundaries.push(bestMid)
  }
  return boundaries
}

export interface ColumnEntry {
  text: string
  yTop: number
  yBottom: number
  /** Rough extraction confidence: 1.0 when the entry is cleanly bounded by
   * gaps well above/below SAME_ENTRY_MAX_GAP on both sides, lower when a
   * boundary was ambiguous (close to the threshold). */
  confidence: number
}

/** Reconstructs one column's own list of distinct entries below a header,
 * merging wrapped continuation lines and splitting on gaps that look like
 * a new entry starting (see SAME_ENTRY_MAX_GAP). */
export function extractColumnEntries(items: TextItem[], column: ColumnBound, belowY: number): ColumnEntry[] {
  // See extractGradeColumnTable's comment: a plain "< belowY" can let a
  // sub-point float difference in the header row's own items slip past,
  // since belowY is usually that row's headerY. Excluding the full line
  // tolerance band is the safe version.
  const colItems = items.filter(
    (it) => it.x >= column.xMin && it.x < column.xMax && it.y < belowY - LINE_Y_TOLERANCE,
  )
  const lines = groupIntoLines(colItems)
  if (lines.length === 0) return []

  const entries: ColumnEntry[] = []
  let current: { texts: string[]; yTop: number; yBottom: number; gaps: number[] } | null = null
  for (const line of lines) {
    if (!current) {
      current = { texts: [line.text], yTop: line.y, yBottom: line.y, gaps: [] }
      continue
    }
    const gap = current.yBottom - line.y
    if (gap <= SAME_ENTRY_MAX_GAP) {
      current.texts.push(line.text)
      current.yBottom = line.y
      current.gaps.push(gap)
    } else {
      entries.push(finishEntry(current))
      current = { texts: [line.text], yTop: line.y, yBottom: line.y, gaps: [] }
    }
  }
  if (current) entries.push(finishEntry(current))
  return entries
}

function finishEntry(current: { texts: string[]; yTop: number; yBottom: number; gaps: number[] }): ColumnEntry {
  // Confidence reflects how unambiguous the gap-based split was: entries
  // built from tightly-clustered lines (small internal gaps, well under the
  // threshold) score higher than a single unwrapped line, which can't be
  // cross-checked against a gap at all.
  const maxInternalGap = current.gaps.length > 0 ? Math.max(...current.gaps) : null
  const confidence = maxInternalGap === null ? 0.75 : maxInternalGap < SAME_ENTRY_MAX_GAP * 0.7 ? 0.9 : 0.8
  return {
    text: current.texts.join(' ').replace(/\s+/g, ' ').trim(),
    yTop: current.yTop,
    yBottom: current.yBottom,
    confidence,
  }
}

export interface GradeColumnRow {
  termNumber: number
  cellsByGrade: Map<number, { text: string; confidence: number }>
}

/**
 * Reads a "Grade 7 | Grade 8 | Grade 9" grid table: the leftmost "Term"
 * column gives the term number for each row; every detected "Grade N"
 * column's text within that row's y-span is that grade's cell for that
 * term. Row anchors are found by a tight x-proximity to the Term header's
 * own x-position (checked against real data: term digits sit right at the
 * header's x, ~70.9 in this project's source), not the general
 * gap-boundary column width — a wide term-column boundary can (and, on a
 * real page, did) swallow the first few characters of the next column's
 * text, which breaks a strict "is this line just a digit" check.
 *
 * Grade-column boundaries are re-derived here rather than trusting the
 * page-wide bounds detectHeaderRow computed: checked against real data and
 * found off — its whole-page gap search can pick up an unrelated gap from
 * content elsewhere on the page and shift every column boundary one column
 * too far right (Grade 7's real content silently reappearing labelled
 * Grade 8, and so on). Rescoping the gap search to only the text between
 * the table's own first and last term row removes that contamination.
 *
 * floorY bounds how far down this table's own scan can reach — needed
 * because a real page (Social Sciences Grades 4-6, page 12) stacks TWO
 * grade-column tables vertically (an Intermediate Phase Grade 4/5/6 summary
 * directly above a Senior Phase Grade 7/8/9 one, both sharing the same Term
 * column x-position). Without a floor, the first table's term-row scan
 * (bounded only by "below this header", with no lower limit) picked up the
 * second table's own term digits too, and its last real row's "until the
 * next term row" bottom boundary landed on the SECOND table's Term 1 row
 * instead of the true page bottom — sweeping that whole second header
 * ("SUMMARY: CONTENT OVERVIEW ... SENIOR PHASE Grade 7") into what should
 * have been the first table's last cell. Pass the next header's headerY (or
 * -Infinity if this is the last/only table on the page) as floorY.
 */
export function extractGradeColumnTable(
  items: TextItem[],
  header: { columns: ColumnBound[]; headerY: number },
  termHeaderX: number,
  floorY = -Infinity,
): GradeColumnRow[] {
  const TERM_X_RADIUS = 10
  // "< header.headerY" alone isn't safe: header.headerY is one specific
  // header-row item's y (whichever sorted first in groupIntoLines), and
  // other items in that same visual row can have a marginally smaller y
  // (sub-point float differences, well under LINE_Y_TOLERANCE) that would
  // otherwise slip past a strict "<" and get read as body content —
  // confirmed as a real bug in extractTopicTimeResourceTable below (a
  // header's own "topic 1" label leaking into the body text it excludes).
  // Subtracting the full line tolerance guarantees the entire header row is
  // excluded, not just the one item headerY happens to come from.
  const termItems = items.filter(
    (it) => Math.abs(it.x - termHeaderX) <= TERM_X_RADIUS && it.y < header.headerY - LINE_Y_TOLERANCE && it.y > floorY,
  )
  const termLines = groupIntoLines(termItems).filter((l) => /^\d+$/.test(l.text))
  if (termLines.length === 0) return []

  const gradeHeaders = header.columns
    .map((col) => {
      const match = col.label.match(/grade\s+(\d{1,2})/i)
      return match ? { gradeNumber: Number(match[1]), x: col.headerX } : null
    })
    .filter((c): c is { gradeNumber: number; x: number } => c !== null)
    .sort((a, b) => a.x - b.x)

  const tableTopY = termLines[0].y
  const tableBottomY = termLines[termLines.length - 1].y - SAME_ENTRY_MAX_GAP * 2
  const tableBodyLines = groupIntoLines(items.filter((it) => it.y <= tableTopY && it.y > tableBottomY))
  const gradeBoundaries = gapBasedBoundaries(
    tableBodyLines.map((l) => l.x),
    gradeHeaders.map((g) => g.x),
    gradeHeaders.length - 1,
  )
  const gradeColumns = gradeHeaders.map((g, i) => ({
    gradeNumber: g.gradeNumber,
    bound: {
      // The first grade column's lower bound must not be -Infinity — that
      // would happily include the Term column's own row-number digits
      // (found this exact leak in real output: "1 Dutch settlement...").
      // Anything past the term digit's own small radius genuinely belongs
      // to the first grade column instead.
      xMin: i === 0 ? termHeaderX + TERM_X_RADIUS : gradeBoundaries[i - 1],
      xMax: i === gradeHeaders.length - 1 ? Infinity : gradeBoundaries[i],
    },
  }))

  const rows: GradeColumnRow[] = []
  for (let i = 0; i < termLines.length; i++) {
    const termNumber = Number(termLines[i].text)
    if (termNumber < 1 || termNumber > 4) continue
    const rowTopY = termLines[i].y
    const rowBottomY = i + 1 < termLines.length ? termLines[i + 1].y : floorY

    const cellsByGrade = new Map<number, { text: string; confidence: number }>()
    for (const { gradeNumber, bound } of gradeColumns) {
      const cellItems = items.filter(
        (it) => it.x >= bound.xMin && it.x < bound.xMax && it.y <= rowTopY && it.y > rowBottomY,
      )
      const lines = groupIntoLines(cellItems)
      if (lines.length === 0) continue
      const text = lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
      if (text) cellsByGrade.set(gradeNumber, { text, confidence: lines.length > 1 ? 0.85 : 0.75 })
    }
    if (cellsByGrade.size > 0) rows.push({ termNumber, cellsByGrade })
  }
  return rows
}

/** Turns a content-outline table's CONTENT-column entries into
 * ExtractedTableCell rows (colIndex 0), for the existing pipeline to pick
 * up the same way it reads any other detected table. gradeNumber/termNumber
 * are left undefined so the caller's ambient section tracking applies (this
 * table shape always sits inside a "TERM n – Grade g" section in practice). */
export function contentColumnCellsToTableCells(entries: ColumnEntry[]): ExtractedTableCell[] {
  return entries.map((entry, i) => ({
    text: entry.text,
    rowIndex: i + 1,
    colIndex: 0,
    confidence: entry.confidence,
  }))
}

/** Turns grade-column rows into ExtractedTableCell rows carrying an
 * explicit gradeNumber/termNumber per cell, since that comes from the
 * table's own structure rather than a preceding marker. */
export function gradeColumnRowsToTableCells(rows: GradeColumnRow[]): ExtractedTableCell[] {
  const cells: ExtractedTableCell[] = []
  let rowIndex = 1
  for (const row of rows) {
    for (const [gradeNumber, cell] of row.cellsByGrade) {
      cells.push({
        text: cell.text,
        rowIndex: rowIndex++,
        colIndex: 0,
        gradeNumber,
        termNumber: row.termNumber,
        confidence: cell.confidence,
      })
    }
  }
  return cells
}

export interface TopicTimeResourceRow {
  topicName: string
  confidence: number
}

/**
 * Reads a "Topic N | Suggested contact time | Recommended resources"
 * mini-table (Creative Arts' Section 3 term plans, one per topic, 2-3 per
 * page) and returns just the genuine topic-name cell from each occurrence —
 * the first entry below that header, in the topic-name column, before the
 * next header takes over. Everything from the second entry onward in that
 * same column (this table's layout always follows the topic name with a
 * "Content/concepts/skills" block in the same x-range) is deliberately left
 * out here: it's real source content too, but a different kind (skills, not
 * a topic name), and mixing it in would misrepresent bullet-point skill
 * detail as if it were the topic's own title.
 *
 * headers must all come from the same page (detectAllHeaderRows) — each
 * occurrence's body is bounded below by the NEXT occurrence's header row,
 * not the page bottom, so one topic's "Content/concepts/skills" detail
 * never bleeds into the next topic's name.
 */
export function extractTopicTimeResourceTable(
  items: TextItem[],
  headers: { columns: ColumnBound[]; headerY: number }[],
): TopicTimeResourceRow[] {
  const sorted = [...headers].sort((a, b) => b.headerY - a.headerY)
  const rows: TopicTimeResourceRow[] = []
  for (let i = 0; i < sorted.length; i++) {
    const header = sorted[i]
    const nextHeaderY = i + 1 < sorted.length ? sorted[i + 1].headerY : -Infinity
    const topicColumn = header.columns[0]
    // Deliberately not the generic gap-based entry split here: checked
    // against real data and it's unreliable at this table's exact line
    // spacing — a wrapped 2-line topic name sits only ~18pt above its own
    // "Content/concepts/skills" line, inside SAME_ENTRY_MAX_GAP's 20pt
    // threshold, so a gap split silently swallowed the skills block (and
    // everything below it) into the topic name. The real boundary here is
    // structural, not a gap: this table shape always follows the topic name
    // with a line reading exactly "Content/concepts/skills", so that's what
    // stops the name.
    // See extractGradeColumnTable's comment on why headerY needs the
    // LINE_Y_TOLERANCE buffer: without it, a sub-point float difference
    // between this header's own row items let its "topic N" label leak
    // into the very body text it's supposed to exclude (confirmed against
    // real output: "topic 1 dramatic skills development" instead of the
    // clean "dramatic skills development").
    const colItems = items.filter(
      (it) =>
        it.x >= topicColumn.xMin &&
        it.x < topicColumn.xMax &&
        it.y < header.headerY - LINE_Y_TOLERANCE &&
        it.y > nextHeaderY,
    )
    const lines = groupIntoLines(colItems)
    const nameLines: string[] = []
    for (const line of lines) {
      if (/^content\/concepts\/skills$/i.test(line.text)) break
      nameLines.push(line.text)
    }
    if (nameLines.length === 0) continue
    rows.push({
      topicName: nameLines.join(' ').replace(/\s+/g, ' ').trim(),
      confidence: nameLines.length > 1 ? 0.85 : 0.8,
    })
  }
  return rows
}

/** Turns topic/time/resource rows into ExtractedTableCell rows (colIndex 0),
 * left without an explicit gradeNumber/termNumber so the caller's ambient
 * section tracking applies — this table shape always sits inside a
 * "senior PHase Term n Grade g" marker, unlike the grade-as-column shape. */
export function topicTimeResourceRowsToTableCells(rows: TopicTimeResourceRow[]): ExtractedTableCell[] {
  return rows.map((row, i) => ({
    text: row.topicName,
    rowIndex: i + 1,
    colIndex: 0,
    confidence: row.confidence,
  }))
}
