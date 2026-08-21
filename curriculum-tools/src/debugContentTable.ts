import { readFile } from 'node:fs/promises'
import { detectHeaderRow, extractColumnEntries } from './parsers/columnTables.js'

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const file = process.argv[2]
  const pageNum = Number(process.argv[3])
  const data = new Uint8Array(await readFile(file))
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()
  interface PdfjsTextItem {
    str: string
    transform: number[]
    width: number
  }
  const items = (content.items as unknown as PdfjsTextItem[])
    .filter((it) => it.str.trim().length > 0)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width }))

  const header = detectHeaderRow(items, [/^CONTENT\s+AREA$/i, /^CONTENT$/i, /^CLARIFICATION$/i])
  console.log('Header found:', header ? { headerY: header.headerY, columns: header.columns } : null)
  if (header) {
    const contentColumn = header.columns[1]
    const entries = extractColumnEntries(items, contentColumn, header.headerY)
    console.log(`\nContent column entries (${entries.length}):`)
    for (const e of entries) console.log(`  [conf=${e.confidence}] "${e.text}"`)
  }
}
main()
