import { readFile } from 'node:fs/promises'
import { detectHeaderRow, extractGradeColumnTable } from './parsers/columnTables.js'

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

  for (let g = 1; g <= 10; g++) {
    const header = detectHeaderRow(items, [
      /^Term$/i,
      new RegExp(`^Grade\\s+${g}$`, 'i'),
      new RegExp(`^Grade\\s+${g + 1}$`, 'i'),
      new RegExp(`^Grade\\s+${g + 2}$`, 'i'),
    ])
    if (header) {
      console.log(`Found header for grades ${g}-${g + 2}:`, header)
      const rows = extractGradeColumnTable(items, header, header.columns[0].headerX)
      console.log('Rows:', JSON.stringify(rows.map(r => ({term: r.termNumber, cells: Object.fromEntries(r.cellsByGrade)})), null, 2))
    }
  }
}
main()
