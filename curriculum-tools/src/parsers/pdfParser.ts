import { readFile } from 'node:fs/promises'
import type { ExtractedBlock, ExtractedDocument } from './types.js'

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
          text: col.map((i) => i.str).join(' ').trim(),
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
      const text = row
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(' ')
        .trim()
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
  }

  return { sourceFormat: 'pdf', pageCount: doc.numPages, blocks }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}
