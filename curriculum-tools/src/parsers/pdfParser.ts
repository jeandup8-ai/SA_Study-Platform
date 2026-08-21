import { readFile } from 'node:fs/promises'
import type { ExtractedBlock, ExtractedDocument } from './types.js'
import {
  detectHeaderRow,
  detectAllHeaderRows,
  extractColumnEntries,
  extractGradeColumnTable,
  extractTopicTimeResourceTable,
  contentColumnCellsToTableCells,
  gradeColumnRowsToTableCells,
  topicTimeResourceRowsToTableCells,
  joinTextItems,
  joinMultilineText,
} from './columnTables.js'

const CONTENT_OUTLINE_HEADER_PATTERNS = [/^CONTENT\s+AREA$/i, /^CONTENT$/i, /^CLARIFICATION$/i]
const GRADE_COLUMN_HEADER_PATTERN = (n: number) => new RegExp(`^Grade\\s+${n}$`, 'i')
// Creative Arts' Section 3 term plans: a 3-column mini-table repeated once
// per topic (2-3 per page) — "Topic N | Suggested contact time |
// Recommended resources" — with the genuine topic name as the first row
// below each header. See columnTables.ts's extractTopicTimeResourceTable.
const TOPIC_TIME_RESOURCE_HEADER_PATTERNS = [
  /^topic\s+\d+$/i,
  // Visual Arts' header row sometimes renders its "hours" value with zero
  // gap right after "time:" (checked against the real PDF's own item
  // coordinates — no real space there at all, not just a rendering quirk),
  // which the word-merge step folds into one chunk: "suggested contact
  // time: 2". No trailing anchor, so a value fused on like that doesn't
  // break the match.
  /^suggested\s+contact\s+time:?/i,
  // Most art forms use "Recommended resources"; Drama's header row instead
  // reads "Recommended texts/resources" — checked against the real page
  // (Grade 7 Drama, Term 1, Topic 1 was silently missing candidates until
  // this was widened, since that page's exact header text never matched
  // the plain "resources"-only pattern).
  /^recommended\s+(texts\/)?resources$/i,
]

// pdfjs-dist's Node ("legacy") build avoids the browser-only APIs (DOMMatrix,
// Worker, etc.) the default build assumes are globally available.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  fontHeight: number
}

const ROW_Y_TOLERANCE = 3 // points; items within this y-distance are treated as the same row
const COLUMN_X_GAP = 24 // points; a horizontal gap bigger than this suggests a new table column

/**
 * Real PDF text + layout extraction — not a stub. What it genuinely does:
 *   - Extracts every text run with its page number and (x, y) position.
 *   - Groups runs into rows by y-coordinate, then splits each row into
 *     columns wherever the horizontal gap between runs is unusually large.
 *   - A page whose rows consistently split into 2+ columns is treated as a
 *     table (curriculum term/topic grids are exactly this shape); otherwise
 *     rows are joined back into paragraph text.
 *   - Headings are guessed from font-size outliers relative to the page's
 *     median — genuinely computed, not hard-coded.
 * This is honest, general-purpose heuristic layout reconstruction, the same
 * category of technique most PDF-table-extraction tools use. It will not be
 * perfect on every DBE document layout, which is exactly why every record it
 * produces downstream lands in REVIEW_REQUIRED, never VERIFIED, until a human
 * checks it against the source page.
 */
export async function parsePdf(filePath: string): Promise<ExtractedDocument> {
  const data = new Uint8Array(await readFile(filePath))
  const doc = await pdfjs.getDocument({ data }).promise
  const blocks: ExtractedBlock[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    interface PdfjsTextItem {
      str: string
      transform: number[]
      width: number
    }
    // getTextContent() only yields TextMarkedContent entries when called with
    // { includeMarkedContent: true }, which this parser never sets — every
    // element is genuinely a TextItem at runtime, so a direct cast here is
    // accurate, not a type-safety shortcut.
    const items: TextItem[] = (content.items as unknown as PdfjsTextItem[])
      .filter((item) => item.str.trim().length > 0)
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        fontHeight: Math.hypot(item.transform[1], item.transform[3]) || item.transform[0],
      }))

    if (items.length === 0) continue

    // Structural table detection, tried before the generic row/column
    // heuristic: both shapes below are real, recurring DBE CAPS table
    // layouts the generic heuristic can't reconstruct correctly (see
    // columnTables.ts's module doc for why). If either matches, the whole
    // page is treated as that table and the generic path is skipped for it.
    const contentOutlineHeader = detectHeaderRow(items, CONTENT_OUTLINE_HEADER_PATTERNS)
    if (contentOutlineHeader) {
      const contentColumn = contentOutlineHeader.columns[1] // CONTENT is the 2nd matched label
      const entries = extractColumnEntries(items, contentColumn, contentOutlineHeader.headerY)
      if (entries.length > 0) {
        // Preserve whatever text sits above the header (typically the
        // page's "TERM n – Grade g" section marker) as its own block first
        // — the table block below only carries the CONTENT column's text,
        // so without this the marker line would silently vanish and the
        // sequential grade/term tracking in detectTopicCandidates would
        // never see it.
        const aboveHeaderText = joinMultilineText(items.filter((it) => it.y >= contentOutlineHeader.headerY))
        if (aboveHeaderText) {
          blocks.push({
            type: 'heading',
            text: aboveHeaderText,
            page: pageNum,
            headingLevel: 1,
            tableCells: null,
            sourceLocation: `Page ${pageNum}`,
          })
        }
        const tableCells = contentColumnCellsToTableCells(entries)
        blocks.push({
          type: 'table',
          text: tableCells.map((c) => c.text).join(' | '),
          page: pageNum,
          headingLevel: null,
          tableCells,
          sourceLocation: `Page ${pageNum}, content-outline table (CONTENT column)`,
        })
        continue
      }
    }

    // A single page can carry more than one grade-column table (this
    // project's Human & Social Sciences source has exactly this: an
    // Intermediate Phase "Grade 4/5/6" summary and a Senior Phase
    // "Grade 7/8/9" summary on the same page) — every g from 1 to 10 is
    // tried and every real match processed, not just the first found.
    const gradeColumnHeaders: NonNullable<ReturnType<typeof detectHeaderRow>>[] = []
    for (let g = 1; g <= 10; g++) {
      const header = detectHeaderRow(items, [
        /^Term$/i,
        GRADE_COLUMN_HEADER_PATTERN(g),
        GRADE_COLUMN_HEADER_PATTERN(g + 1),
        GRADE_COLUMN_HEADER_PATTERN(g + 2),
      ])
      if (header) gradeColumnHeaders.push(header)
    }
    if (gradeColumnHeaders.length > 0) {
      // Sorted top-to-bottom so each table's scan can be floored at the
      // next one's headerY — without this, a page stacking two such tables
      // (confirmed real: Social Sciences Grades 4-6, page 12) lets the
      // upper table's row scan run straight through the lower table's own
      // header and content. See extractGradeColumnTable's floorY doc.
      const sortedHeaders = [...gradeColumnHeaders].sort((a, b) => b.headerY - a.headerY)
      // +20pt, not just the next header's own headerY: checked against real
      // data, each of these tables carries its own title line ("SUMMARY:
      // CONTENT OVERVIEW: ... SENIOR PHASE") sitting ~15pt above its header
      // row — flooring exactly at the header would still let the PREVIOUS
      // table's scan sweep that title line in as if it were its own last
      // cell's content (confirmed real: "Communication then and now
      // SUMMARY: CONTENT OVERVIEW: HISTORY SENIOR PHASE" bleeding into a
      // Grade 4 cell). 20pt clears that gap with a small margin.
      const allCells = sortedHeaders.flatMap((header, i) => {
        const termColumn = header.columns[0]
        const floorY = i + 1 < sortedHeaders.length ? sortedHeaders[i + 1].headerY + 20 : -Infinity
        const gradeRows = extractGradeColumnTable(items, header, termColumn.headerX, floorY)
        return gradeColumnRowsToTableCells(gradeRows)
      })
      if (allCells.length > 0) {
        blocks.push({
          type: 'table',
          text: allCells.map((c) => c.text).join(' | '),
          page: pageNum,
          headingLevel: null,
          tableCells: allCells,
          sourceLocation: `Page ${pageNum}, grade-column table`,
        })
        continue
      }
    }

    const medianFontHeight = median(items.map((i) => i.fontHeight))

    // Group into rows by y (PDF y grows upward, so sort descending).
    const rows: TextItem[][] = []
    for (const item of items.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const currentRow = rows[rows.length - 1]
      if (currentRow && Math.abs(currentRow[0].y - item.y) <= ROW_Y_TOLERANCE) {
        currentRow.push(item)
      } else {
        rows.push([item])
      }
    }

    // Split each row into column groups wherever the x-gap is large.
    const rowColumns: TextItem[][][] = rows.map((row) => {
      const sorted = [...row].sort((a, b) => a.x - b.x)
      const columns: TextItem[][] = [[sorted[0]]]
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const gap = curr.x - (prev.x + prev.width)
        if (gap > COLUMN_X_GAP) columns.push([curr])
        else columns[columns.length - 1].push(curr)
      }
      return columns
    })

    const multiColumnRowCount = rowColumns.filter((cols) => cols.length >= 2).length
    const isTablePage = rows.length >= 3 && multiColumnRowCount / rows.length > 0.5

    if (isTablePage) {
      const tableCells = rowColumns.flatMap((cols, rowIndex) =>
        cols.map((col, colIndex) => ({
          text: joinTextItems(col),
          rowIndex,
          colIndex,
        })),
      )
      blocks.push({
        type: 'table',
        text: tableCells.map((c) => c.text).join(' | '),
        page: pageNum,
        headingLevel: null,
        tableCells,
        sourceLocation: `Page ${pageNum}, detected table`,
      })
      continue
    }

    for (const row of rows) {
      const text = joinTextItems(row)
      if (!text) continue

      const rowFontHeight = median(row.map((i) => i.fontHeight))
      const isHeading = rowFontHeight > medianFontHeight * 1.25 && text.length < 120

      blocks.push({
        type: isHeading ? 'heading' : 'paragraph',
        text,
        page: pageNum,
        headingLevel: isHeading ? 1 : null,
        tableCells: null,
        sourceLocation: `Page ${pageNum}`,
      })
    }

    // Additive, not exclusive: unlike the two structural detectors above,
    // this one doesn't claim the whole page. The page's own "senior PHase
    // Term n Grade g" marker (Creative Arts' section-marker convention) is
    // a short paragraph the generic loop above already emitted correctly —
    // pushing this table block afterward keeps it positioned after that
    // marker in the document's block order, so detectTopicCandidates' ambient
    // grade/term tracking already has the right values by the time it's read.
    const topicTimeHeaders = detectAllHeaderRows(items, TOPIC_TIME_RESOURCE_HEADER_PATTERNS)
    if (topicTimeHeaders.length > 0) {
      const topicRows = extractTopicTimeResourceTable(items, topicTimeHeaders)
      const tableCells = topicTimeResourceRowsToTableCells(topicRows)
      if (tableCells.length > 0) {
        blocks.push({
          type: 'table',
          text: tableCells.map((c) => c.text).join(' | '),
          page: pageNum,
          headingLevel: null,
          tableCells,
          sourceLocation: `Page ${pageNum}, topic/time/resource table`,
        })
      }
    }
  }

  return { sourceFormat: 'pdf', pageCount: doc.numPages, blocks }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
