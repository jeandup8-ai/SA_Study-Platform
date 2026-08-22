import type { ExtractedTableCell, BoundingBox } from './types.js'

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

/** Real bounding box over the given items' own x/y/width — null when there's
 * nothing to bound. Used everywhere a detector wants to record where on the
 * page an entry actually came from, rather than the column's whole (often
 * much wider) allotted strip. */
function bboxOfItems(items: { x: number; y: number; width: number }[]): BoundingBox | null {
  if (items.length === 0) return null
  return {
    xMin: Math.min(...items.map((it) => it.x)),
    xMax: Math.max(...items.map((it) => it.x + it.width)),
    yTop: Math.max(...items.map((it) => it.y)),
    yBottom: Math.min(...items.map((it) => it.y)),
  }
}

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

export function groupIntoLines(items: TextItem[]): { y: number; x: number; text: string }[] {
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
  rowTolerance = LINE_Y_TOLERANCE,
): { columns: ColumnBound[]; headerY: number } | null {
  const lines = groupIntoLines(items)
  for (const line of lines) {
    // A header row's own items, not the merged line text: re-derive
    // word-level chunks at this y so we get per-label x, not one blob (and
    // so a font-driven mid-word split, e.g. "t" / "opic" as separate pdfjs
    // items, still matches a "topic" label pattern — see mergeWordChunks).
    // rowTolerance, not the module default, on this one filter: a caller
    // whose real documents sometimes print one header label a few points
    // off the others' baseline (see detectAllHeaderRows' doc) can widen
    // just this match window without affecting how lines are grouped
    // everywhere else in this file.
    const rowItems = items.filter((it) => Math.abs(it.y - line.y) <= rowTolerance)
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
  rowTolerance = LINE_Y_TOLERANCE,
): { columns: ColumnBound[]; headerY: number }[] {
  const results: { columns: ColumnBound[]; headerY: number }[] = []
  const lines = groupIntoLines(items)
  for (const line of lines) {
    // Checked against real data (Creative Arts Grade 7-9 Drama, pages 42
    // and 43): a header occurrence's three labels don't always share one
    // exact y — "suggested contact time" sometimes prints ~8pt below
    // "topic N"/"recommended resources" on the same header, which the
    // module-default LINE_Y_TOLERANCE(2pt) can't bridge, silently dropping
    // that whole topic occurrence. A caller can pass a wider rowTolerance
    // for exactly this; already skipped once by the guard below when a
    // widened window means TWO of groupIntoLines' own separately-grouped
    // lines (e.g. this y=531.3 "line" and the y=522.9 one 8.4pt below it)
    // would otherwise both independently re-detect the same occurrence.
    if (results.some((r) => Math.abs(r.headerY - line.y) <= rowTolerance)) continue
    const rowItems = items.filter((it) => Math.abs(it.y - line.y) <= rowTolerance)
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
  bbox?: BoundingBox
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
      entries.push(finishEntry(current, colItems))
      current = { texts: [line.text], yTop: line.y, yBottom: line.y, gaps: [] }
    }
  }
  if (current) entries.push(finishEntry(current, colItems))
  return entries
}

function finishEntry(
  current: { texts: string[]; yTop: number; yBottom: number; gaps: number[] },
  columnItems: TextItem[],
): ColumnEntry {
  // Confidence reflects how unambiguous the gap-based split was: entries
  // built from tightly-clustered lines (small internal gaps, well under the
  // threshold) score higher than a single unwrapped line, which can't be
  // cross-checked against a gap at all.
  const maxInternalGap = current.gaps.length > 0 ? Math.max(...current.gaps) : null
  const confidence = maxInternalGap === null ? 0.75 : maxInternalGap < SAME_ENTRY_MAX_GAP * 0.7 ? 0.9 : 0.8
  const region = columnItems.filter(
    (it) => it.y <= current.yTop + LINE_Y_TOLERANCE && it.y >= current.yBottom - LINE_Y_TOLERANCE,
  )
  return {
    text: current.texts.join(' ').replace(/\s+/g, ' ').trim(),
    yTop: current.yTop,
    yBottom: current.yBottom,
    confidence,
    bbox: bboxOfItems(region) ?? undefined,
  }
}

export interface GradeColumnRow {
  termNumber: number
  cellsByGrade: Map<number, { text: string; confidence: number; bbox?: BoundingBox }>
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
  // Deliberately still the per-LINE x-minimum here, not individual item
  // x-starts: tried switching this to individual items (the same fix used
  // for this file's rotated content-outline and Life Skills detectors,
  // since this table's rows also routinely have all three grade cells
  // sharing one y) and checked it against real output — it made things
  // worse, not better. This table's own header labels sit well to the
  // RIGHT of where each column's real body text starts (Grade 7's header
  // at x=156.0 but its real text starts at x=103.4; Grade 8 at 308.6 vs
  // 250.1; Grade 9 at 451.2 vs 408.5 — the same "header padded away from
  // body text" shape detectHeaderRow's own doc already warns about), so
  // gapBasedBoundaries' per-pair search — scoped strictly between each
  // pair's own header x — never even sees the LEFT column's real text
  // (it sits left of "lo") once individual items are used, starving the
  // search down to one column's own line-wrap noise and producing an
  // erratic boundary. The line-based version happens to still work
  // reasonably for this table specifically, because a shared-row line's
  // reported x already collapses to the left-most column's real x, and
  // wrapped continuation lines (which don't share a row) contribute the
  // other columns' real x under their own line entries — imperfect, but
  // confirmed against real output to still separate Grade 7/8/9 correctly
  // in the large majority of rows. Left as-is per A4's own instruction not
  // to silently alter already-correct records while chasing one bug.
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

    const cellsByGrade = new Map<number, { text: string; confidence: number; bbox?: BoundingBox }>()
    for (const { gradeNumber, bound } of gradeColumns) {
      const cellItems = items.filter(
        (it) => it.x >= bound.xMin && it.x < bound.xMax && it.y <= rowTopY && it.y > rowBottomY,
      )
      const lines = groupIntoLines(cellItems)
      if (lines.length === 0) continue
      const text = lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
      if (text) {
        cellsByGrade.set(gradeNumber, {
          text,
          confidence: lines.length > 1 ? 0.85 : 0.75,
          bbox: bboxOfItems(cellItems) ?? undefined,
        })
      }
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
    bbox: entry.bbox,
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
        bbox: cell.bbox,
      })
    }
  }
  return cells
}

export interface TopicTimeResourceRow {
  topicName: string
  confidence: number
  bbox?: BoundingBox
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
    const nameLineYs: number[] = []
    for (const line of lines) {
      if (/^content\/concepts\/skills$/i.test(line.text)) break
      nameLines.push(line.text)
      nameLineYs.push(line.y)
    }
    if (nameLines.length === 0) continue
    const region = colItems.filter((it) => nameLineYs.some((y) => Math.abs(y - it.y) <= LINE_Y_TOLERANCE))
    rows.push({
      topicName: nameLines.join(' ').replace(/\s+/g, ' ').trim(),
      confidence: nameLines.length > 1 ? 0.85 : 0.8,
      bbox: bboxOfItems(region) ?? undefined,
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
    bbox: row.bbox,
  }))
}

export interface RotatedTopicRow {
  topicName: string
  confidence: number
  /** Bounding box in the same LOGICAL (as-if-horizontal) coordinate space the
   * caller already transformed rotated items into — not raw page space. See
   * pdfParser.ts's rotated-page transform for how to map back if ever needed. */
  bbox?: BoundingBox
}

export interface RotatedTopicBlock {
  /** This occurrence's own header row y, in logical space — the caller uses
   * this to bound the "Grade n term m" / "strand: ..." marker text that
   * sits above this occurrence's header and below the previous occurrence's
   * last topic row. */
  headerY: number
  rows: RotatedTopicRow[]
}

/** Natural Sciences Grade7-9's rotated table repeats its own title line
 * ("Grade 7 term 1" / "strand: liFe and livinG") directly above each
 * TIME/TOPIC/CONTENT header occurrence, the same shape
 * extractGradeColumnTable found for its "SUMMARY: CONTENT OVERVIEW" title
 * line — a fixed content floor right at the next occurrence's headerY
 * risks that title text (if it falls inside the TOPIC column's own
 * x-range) leaking into the previous occurrence's last topic entry as a
 * spurious trailing line. Same fix as there: floor a fixed margin below the
 * next header instead of exactly at it. */
const ROTATED_TABLE_FLOOR_MARGIN = 20

/**
 * Reads the TOPIC column of a rotated CAPS content table (this project's
 * confirmed case: Natural Sciences Grade 7-9's Senior Phase section, pages
 * 18-89, entirely authored in landscape with body text rotated 90°) — a
 * TIME | TOPIC | CONTENT & CONCEPTS | SUGGESTED ACTIVITIES | RESOURCES
 * table — once the caller has already converted the page's items into
 * logical (as-if-horizontal) coordinates via the transform
 * logical_x = pageY, logical_y = -pageX (validated against this exact
 * document: reading order within one rotated line runs with increasing
 * page-y, and successive lines stack with increasing page-x, which maps
 * cleanly onto this codebase's existing "sort descending logical-y is
 * top-to-bottom" convention used everywhere else in this file).
 *
 * Uses detectAllHeaderRows, not detectHeaderRow: checked against real pages,
 * this table's header repeats multiple times down one page (once per
 * grade/term/strand block), the same repeated-mini-table shape
 * extractTopicTimeResourceTable already handles for Creative Arts.
 *
 * detectHeaderRow/detectAllHeaderRows' own boundary derivation is reused
 * only for finding each header row itself (TIME/TOPIC/CONTENT all present
 * on one line) — their gapBasedBoundaries call is NOT reused for the actual
 * column split, because that call feeds gapBasedBoundaries the per-LINE
 * x-minimum (groupIntoLines), which silently conflates columns whenever
 * more than one column's cell shares a line's exact y. Checked against real
 * data: this table is dense enough that this happens on almost every row
 * (e.g. a genuine CONTENT-column line "t he concept of the biosphere"
 * starting at x=204.3 sits on the same logical-y as a TOPIC-column "the
 * biosphere" ending ~184.7) — a line-minimum-based boundary search picked
 * up that CONTENT text's own leading fragment as if it were still inside
 * TOPIC. Individual item x-start positions don't have this failure mode:
 * each column's own items keep their own x even when they share a row, so
 * the true TOPIC/CONTENT gap (43.6pt in the manually-verified sample) still
 * stands out cleanly against gapBasedBoundaries' largest-gap search. This
 * function re-runs that exact same, already-validated gapBasedBoundaries
 * helper — just against item x-starts instead of line x-minimums, scoped to
 * this one occurrence's own body items — rather than inventing new boundary
 * logic, so it inherits the same fallback behaviour (header-midpoint) for
 * an empty column.
 */
export function extractRotatedContentOutlineTopics(items: TextItem[]): RotatedTopicBlock[] {
  const headers = detectAllHeaderRows(items, [/^time$/i, /^topic$/i, /^content/i])
  if (headers.length === 0) return []
  const sorted = [...headers].sort((a, b) => b.headerY - a.headerY)
  const blocks: RotatedTopicBlock[] = []
  for (let i = 0; i < sorted.length; i++) {
    const header = sorted[i]
    const timeCol = header.columns.find((c) => /^time$/i.test(c.label))
    const topicCol = header.columns.find((c) => /^topic$/i.test(c.label))
    const contentCol = header.columns.find((c) => /^content/i.test(c.label))
    if (!timeCol || !topicCol || !contentCol) continue

    const floorY = i + 1 < sorted.length ? sorted[i + 1].headerY + ROTATED_TABLE_FLOOR_MARGIN : -Infinity
    const bodyItems = items.filter((it) => it.y < header.headerY - LINE_Y_TOLERANCE && it.y > floorY)
    const boundaries = gapBasedBoundaries(
      bodyItems.map((it) => it.x),
      [timeCol.headerX, topicCol.headerX, contentCol.headerX],
      2,
    )
    const correctedTopicColumn: ColumnBound = {
      label: topicCol.label,
      xMin: boundaries[0],
      xMax: boundaries[1],
      headerX: topicCol.headerX,
    }

    const entries = extractColumnEntries(bodyItems, correctedTopicColumn, header.headerY)
      .filter((e) => isPlausibleRotatedTopicName(e.text))
    if (entries.length > 0) {
      blocks.push({
        headerY: header.headerY,
        // Confidence capped well below what extractColumnEntries computed:
        // that score only reflects gap-cleanliness of the entry split, not
        // this table shape's own known, separate failure mode — checked
        // against a full run over all 71 rotated pages, a real fraction of
        // surviving entries are missing their own first 1-2 characters
        // (e.g. "he solar ystem", "ithosphere" for what the source page
        // actually reads as "The solar system", "Lithosphere") from a
        // rotation-specific font-run split this fix does not address. Every
        // record still lands as REVIEW_REQUIRED regardless, but a reviewer
        // should see this table shape trusted less than the other three.
        rows: entries.map((e) => ({ topicName: e.text, confidence: Math.min(e.confidence, 0.5), bbox: e.bbox })),
      })
    }
  }
  return blocks
}

/** Checked against a full run over the real document (all 71 rotated
 * pages, 18-89): the single-boundary-per-occurrence gap search above works
 * cleanly on some occurrences (e.g. page 22's isolated "the biosphere") but
 * not others — the CONTENT column's own bullet-list text varies in x
 * line-to-line (hanging-indent bullets, not one consistent left margin the
 * way this project's other 3 table shapes have), so on a page where that
 * variation is wide the single computed boundary lets bullet fragments
 * ("•", "d •"), boilerplate ("Learners should read, write, draw..."), and
 * mid-word truncations through as if they were topic names. Rather than
 * publish those as invented/garbled topic candidates, this is a hard
 * content-shape filter applied after the geometric extraction: a genuine
 * topic name in this table never contains a bullet character or is
 * dominated by non-alphabetic characters, so anything that does gets
 * dropped here — real recall loss on this table shape, preferred over
 * passing corrupted text through as if it were genuine CAPS content. */
// This exact recurring note ("Learners should read, write, draw and do
// practical tasks regularly ... learner's notebook") appears, with slightly
// different wrap/truncation each time (so an exact-match frequency filter
// like dropRepeatedRunningText wouldn't reliably catch every instance),
// across many of this table's occurrences — a generic notebook-keeping
// instruction, not a topic name. No genuine CAPS topic in this document
// starts with this wording, so matching on its distinctive opening phrase
// is safe.
const ROTATED_TABLE_NOTEBOOK_BOILERPLATE = /learners should read,?\s*write,?\s*draw/i

function isPlausibleRotatedTopicName(text: string): boolean {
  if (text.includes('•')) return false
  if (ROTATED_TABLE_NOTEBOOK_BOILERPLATE.test(text)) return false
  const alpha = (text.match(/[a-zA-Z]/g) ?? []).length
  if (alpha < 3) return false
  if (alpha / text.length < 0.6) return false
  return true
}

/** Turns rotated content-outline TOPIC-column rows into ExtractedTableCell
 * rows (colIndex 0), left without an explicit gradeNumber/termNumber so the
 * caller's ambient section tracking applies — this table shape always sits
 * inside its own rotated "Grade n term m" / "strand: ..." marker, which the
 * caller must extract and push as a preceding block for that tracking to see. */
export function rotatedTopicRowsToTableCells(rows: RotatedTopicRow[]): ExtractedTableCell[] {
  return rows.map((row, i) => ({
    text: row.topicName,
    rowIndex: i + 1,
    colIndex: 0,
    confidence: row.confidence,
    bbox: row.bbox,
  }))
}

export interface LifeSkillsTopicRow {
  termNumber: number
  gradeNumber: number
  topicName: string
  confidence: number
  bbox?: BoundingBox
}

const LIFE_SKILLS_HEADER_PATTERNS = [/^term\s+[1-4]$/i, /^grade\s+\d{1,2}$/i, /^recommended\s+resources?$/i]
/** A genuine time-column value in this document is always a short duration
 * like "3 hours" or "4½ hours" — checked against real data, this is the
 * distinguishing shape that separates a real time-column entry from an
 * unrelated content-column line that merely happens to land closest to the
 * time column's x (see extractLifeSkillsTopicTable's row-boundary doc). */
const LIFE_SKILLS_DURATION_PATTERN = /^\d+(?:[.,]\d+)?½?\s*hours?$/i
/** A row-content line starting with a bullet or sub-bullet dash marks the
 * end of a topic's own name text and the start of its content detail —
 * checked against real data (this document's "Personal and Social
 * Well-being" and "Visual Arts" sections both use "•" for a topic's
 * top-level content points and "-" for a nested sub-point). */
const LIFE_SKILLS_BULLET_PATTERN = /^[•\-–—]/

/**
 * Life Skills Grades 4-6 has no generic multi-subject table shape this
 * project's other detectors already cover — checked against the real
 * document, its "Personal and Social Well-being" and "Visual Arts"
 * components use their own distinct 3-column layout: a header row reading
 * "TERM n | GRADE g | Recommended resources" (this IS the whole header —
 * the topic and time columns have no label of their own at all, only
 * implied by position), followed by one row per topic: the topic name
 * (e.g. "Topic 1: Development of the self", sometimes wrapping to a second
 * line, sometimes with no "Topic n:" prefix at all for a later row in the
 * same section), a suggested-time value ("6 hours") on the SAME row, and a
 * resources list in the third column — then that topic's own content
 * bullets, at the SAME x as the topic column, immediately below.
 *
 * Column boundaries are NOT derived by the shared gap-based search used
 * elsewhere in this file: checked against real coordinates, this table
 * doesn't need it and gap-search would be actively wrong here — this
 * table's header labels ("TERM 1", "GRADE 4", "Recommended resources")
 * happen to sit at EXACTLY the x each column's own body text starts at (no
 * padding/centring the way Mathematics' CONTENT/CLARIFICATION headers do),
 * so a line is simply assigned to whichever of the three header x-positions
 * it sits closest to. The three columns are also far enough apart (~200pt
 * and ~80pt gaps, verified against real data) that this never confuses a
 * topic-column's own indented sub-bullets (only ~8.5pt right of the topic
 * column's own x) for the time or resources column.
 *
 * A row boundary (this table has no per-row ruling/box to detect
 * structurally) is found the same way: a topic-column line only starts a
 * NEW topic entry when its own y lines up with a genuine time-column
 * value's y (a bare "N hours" line) — content bullets never have a time
 * value beside them, so this reliably tells a new topic's first line apart
 * from the previous topic's own trailing content.
 *
 * Deliberately does NOT read every bullet as its own topic (the spec's own
 * A2 requirement) — once a topic's first bullet line is seen, everything
 * until the next real row start is content detail, not additional topics,
 * matching the same "topic name only, not the skills/content beneath it"
 * scope this file's extractTopicTimeResourceTable already uses for
 * Creative Arts.
 *
 * Only fires where this exact header is actually found — checked against
 * the real document, Physical Education's own pages use a much less
 * regular layout (time values embedded inline inside wrapped resource/
 * activity text rather than their own row-aligned column), which this
 * detector cannot safely reconstruct without risking a wrong topic/time
 * split; those pages are left to the generic fallback path instead of
 * guessing, consistent with "ambiguous → REVIEW_REQUIRED", or in this case
 * "ambiguous → don't force a structural read at all".
 */
export function extractLifeSkillsTopicTable(items: TextItem[]): LifeSkillsTopicRow[] {
  const headers = detectAllHeaderRows(items, LIFE_SKILLS_HEADER_PATTERNS)
  if (headers.length === 0) return []
  const sorted = [...headers].sort((a, b) => b.headerY - a.headerY)
  const rows: LifeSkillsTopicRow[] = []

  for (let i = 0; i < sorted.length; i++) {
    const header = sorted[i]
    const termCol = header.columns.find((c) => /^term/i.test(c.label))
    const gradeCol = header.columns.find((c) => /^grade/i.test(c.label))
    const resourcesCol = header.columns.find((c) => /^recommended/i.test(c.label))
    if (!termCol || !gradeCol || !resourcesCol) continue
    const termNumber = Number(termCol.label.match(/\d+/)?.[0])
    const gradeNumber = Number(gradeCol.label.match(/\d+/)?.[0])
    if (!termNumber || !gradeNumber) continue

    const topicX = termCol.headerX
    const timeX = gradeCol.headerX
    const resourcesX = resourcesCol.headerX

    const floorY = i + 1 < sorted.length ? sorted[i + 1].headerY : -Infinity
    const bodyItems = items.filter((it) => it.y < header.headerY - LINE_Y_TOLERANCE && it.y > floorY)

    // Classified per ITEM, not per line: a row-start row genuinely has all
    // three columns sharing the exact same y (confirmed against real data —
    // "Topic 1:" / "6 hours" / "Textbook, ..." all sit at one identical y).
    // groupIntoLines merges every item at the same y into one combined line
    // first — doing that before column-splitting would merge all three
    // columns' text into one blob whose own x is always the topic column's
    // (the leftmost), so no line would ever read as "time column" and no
    // row boundary could ever be found. Splitting by nearest column at the
    // item level first, then grouping each column's own items into lines
    // separately, avoids that: within one already-isolated column, sharing
    // a y with another item is never a cross-column conflation.
    const topicItems: TextItem[] = []
    const timeItems: TextItem[] = []
    for (const it of bodyItems) {
      const dTopic = Math.abs(it.x - topicX)
      const dTime = Math.abs(it.x - timeX)
      const dResources = Math.abs(it.x - resourcesX)
      const nearest = Math.min(dTopic, dTime, dResources)
      if (nearest === dTopic) topicItems.push(it)
      else if (nearest === dTime) timeItems.push(it)
      // Resources-column items aren't needed for topic-name extraction.
    }
    const topicLines = groupIntoLines(topicItems)
    // Only a line that actually reads as a duration counts as a real
    // time-column value — checked against real data (Grade 6 Term 3, page
    // 30): a wrapped content bullet that happens to spill wide enough to
    // land closer to the time column's x than the topic column's ("flag,
    // anthem," / "code of arms, etc.", continuing "- National symbols such
    // as" on the same y) would otherwise manufacture a false row boundary
    // and split a bullet's own wrapped continuation off as if it were a new
    // topic's name.
    const timeLineYs = groupIntoLines(timeItems)
      .filter((l) => LIFE_SKILLS_DURATION_PATTERN.test(l.text.trim()))
      .map((l) => l.y)
    const isRowStart = (y: number) => timeLineYs.some((ty) => Math.abs(ty - y) <= LINE_Y_TOLERANCE)

    let current: string[] | null = null
    let currentYs: number[] = []
    let sawBullet = false
    const finish = () => {
      if (!current || current.length === 0) return
      const text = current.join(' ').replace(/\s+/g, ' ').trim()
      if (text) {
        const region = topicItems.filter((it) => currentYs.some((y) => Math.abs(y - it.y) <= LINE_Y_TOLERANCE))
        rows.push({
          termNumber,
          gradeNumber,
          topicName: text,
          confidence: current.length > 1 ? 0.8 : 0.75,
          bbox: bboxOfItems(region) ?? undefined,
        })
      }
    }
    for (const line of topicLines) {
      if (isRowStart(line.y)) {
        finish()
        current = [line.text]
        currentYs = [line.y]
        sawBullet = false
        continue
      }
      if (!current || sawBullet) continue
      if (LIFE_SKILLS_BULLET_PATTERN.test(line.text.trim())) {
        sawBullet = true
        continue
      }
      current.push(line.text)
      currentYs.push(line.y)
    }
    finish()
  }
  return rows
}

/** Turns Life Skills topic rows into ExtractedTableCell rows carrying an
 * explicit gradeNumber/termNumber per cell, since both come from the
 * table's own header rather than a preceding ambient marker (the same
 * reasoning as gradeColumnRowsToTableCells). */
export function lifeSkillsTopicRowsToTableCells(rows: LifeSkillsTopicRow[]): ExtractedTableCell[] {
  return rows.map((row, i) => ({
    text: row.topicName,
    rowIndex: i + 1,
    colIndex: 0,
    gradeNumber: row.gradeNumber,
    termNumber: row.termNumber,
    confidence: row.confidence,
    bbox: row.bbox,
  }))
}
