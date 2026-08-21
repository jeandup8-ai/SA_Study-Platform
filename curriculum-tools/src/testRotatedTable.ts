import { readFile } from 'node:fs/promises'
import { extractRotatedContentOutlineTopics, joinMultilineText, type TextItem } from './parsers/columnTables.js'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

function isRotated(transform: number[]): boolean {
  const angle = (Math.atan2(transform[1], transform[0]) * 180) / Math.PI
  return Math.abs(angle) > 45 && Math.abs(angle) < 135
}

function toLogical(rawItems: { str: string; transform: number[]; width: number }[]): TextItem[] {
  const out: TextItem[] = []
  for (const it of rawItems) {
    if (!it.str || !it.str.trim()) continue
    if (!isRotated(it.transform)) continue
    const x = it.transform[4]
    const y = it.transform[5]
    out.push({ str: it.str, x: y, y: -x, width: it.width })
  }
  return out
}

async function main() {
  const file = process.argv[2]
  const pageStart = Number(process.argv[3] ?? 20)
  const pageEnd = Number(process.argv[4] ?? pageStart)
  const data = new Uint8Array(await readFile(file))
  const doc = await pdfjs.getDocument({ data }).promise

  for (let pageNum = pageStart; pageNum <= pageEnd; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const raw = content.items as unknown as { str: string; transform: number[]; width: number }[]
    const rotatedCount = raw.filter((it) => it.str.trim() && isRotated(it.transform)).length
    const totalCount = raw.filter((it) => it.str.trim()).length
    if (totalCount === 0) continue
    const items = toLogical(raw)
    console.log(`\n=== Page ${pageNum} (${rotatedCount}/${totalCount} rotated) ===`)
    if (rotatedCount / totalCount < 0.5) {
      console.log('  not a rotated page, skipping')
      continue
    }
    const blocks = extractRotatedContentOutlineTopics(items)
    console.log(`  ${blocks.length} header block(s) found`)
    for (const block of blocks) {
      const markerItems = items.filter((it) => it.y > block.headerY)
      const marker = joinMultilineText(markerItems).slice(0, 120)
      console.log(`  -- headerY=${block.headerY.toFixed(1)} marker="${marker}"`)
      for (const row of block.rows) {
        console.log(`     [conf=${row.confidence.toFixed(2)}] "${row.topicName}"`)
      }
    }
  }
}
main()
