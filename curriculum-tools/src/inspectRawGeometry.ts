/**
 * Diagnostic: dumps raw pdfjs text-item geometry (x, y, width, height,
 * fontHeight, text) for a page range, unfiltered by any row/column
 * clustering heuristic — used to design/validate the table reconstructor
 * against real problem pages. Not part of the import pipeline itself.
 *
 * Usage: npm run inspect-raw-geometry -- <file.pdf> <page> [xMin] [xMax]
 */
import { readFile } from 'node:fs/promises'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

async function main() {
  const file = process.argv[2]
  const targetPage = Number(process.argv[3])
  const xMin = process.argv[4] ? Number(process.argv[4]) : -Infinity
  const xMax = process.argv[5] ? Number(process.argv[5]) : Infinity
  const data = new Uint8Array(await readFile(file))
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(targetPage)
  const content = await page.getTextContent()
  const viewport = page.getViewport({ scale: 1 })
  console.log(`Page ${targetPage}, viewport ${viewport.width}x${viewport.height}`)
  interface Item {
    str: string
    transform: number[]
    width: number
    height: number
  }
  const items = content.items as unknown as Item[]
  const rows = items
    .map((it) => ({
      text: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      height: it.height,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  for (const r of rows) {
    if (!r.text.trim()) continue
    if (r.x < xMin || r.x > xMax) continue
    console.log(`x=${r.x.toFixed(1).padStart(7)} y=${r.y.toFixed(1).padStart(7)} w=${r.width.toFixed(1).padStart(6)} "${r.text}"`)
  }
}
main()
