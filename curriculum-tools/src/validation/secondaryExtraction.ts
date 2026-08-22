import { readFile } from 'node:fs/promises'

/**
 * Independent "Method B" text extraction for validating what the primary,
 * structural extractor (pdfParser.ts + columnTables.ts) already wrote to the
 * database. This is deliberately NOT the same code path: no header
 * detection, no column-boundary search, no table-cell reconstruction — just
 * every text run on a page, in reading order, joined into one plain string.
 * It shares only the unavoidable low-level PDF primitives (pdfjs-dist's raw
 * text items, and the same rotation check the primary parser uses) — without
 * those, a rotated page would misread as vertically-stacked garbage under
 * EITHER method, which would falsely fail an honest exact-text-match check
 * rather than genuinely cross-check it.
 *
 * The point of Method B is to answer one question a structural detector
 * cannot answer about itself: "does this exact candidate text really appear
 * on the page it claims to come from?" — using evidence built a different
 * way. Two structural detectors disagreeing would tell you the table shape
 * is ambiguous; a structural extraction disagreeing with a plain reading-
 * order dump tells you something more basic may be wrong (wrong page, wrong
 * document, or a corrupted/invented value).
 */

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

interface Item {
  str: string
  x: number
  y: number
  width: number
}

function isRotatedItem(transform: number[]): boolean {
  const angle = (Math.atan2(transform[1], transform[0]) * 180) / Math.PI
  return Math.abs(angle) > 45 && Math.abs(angle) < 135
}

/** Plain row-major reading-order text for one page's items: group by y
 * (descending, i.e. top to bottom), then x within a row (ascending, i.e.
 * left to right), joined with single spaces; rows joined with newlines. No
 * column/table structure of any kind. */
function readingOrderText(items: Item[]): string {
  const ROW_TOLERANCE = 3
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  for (const item of sorted) {
    const row = rows[rows.length - 1]
    if (row && Math.abs(row[0].y - item.y) <= ROW_TOLERANCE) row.push(item)
    else rows.push([item])
  }
  return rows
    .map((row) => row.map((it) => it.str).join(' '))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
}

export interface SecondaryDocumentText {
  /** 1-indexed page number -> plain reading-order text for that page. */
  byPage: Map<number, string>
  pageCount: number
}

export async function extractSecondaryPageText(filePath: string): Promise<SecondaryDocumentText> {
  const data = new Uint8Array(await readFile(filePath))
  const doc = await pdfjs.getDocument({ data }).promise
  const byPage = new Map<number, string>()

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    interface PdfjsTextItem {
      str: string
      transform: number[]
      width: number
    }
    const rawItems = (content.items as unknown as PdfjsTextItem[]).filter((item) => item.str.trim().length > 0)
    if (rawItems.length === 0) {
      byPage.set(pageNum, '')
      continue
    }

    const rotatedCount = rawItems.filter((it) => isRotatedItem(it.transform)).length
    const isRotatedPage = rotatedCount / rawItems.length > 0.5

    const items: Item[] = isRotatedPage
      ? rawItems.map((it) => ({
          str: it.str,
          x: it.transform[5],
          y: -it.transform[4],
          width: it.width,
        }))
      : rawItems.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }))

    byPage.set(pageNum, readingOrderText(items))
  }

  return { byPage, pageCount: doc.numPages }
}
