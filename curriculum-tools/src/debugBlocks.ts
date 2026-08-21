import { parsePdf } from './parsers/pdfParser.js'

async function main() {
  const file = process.argv[2]
  const startPage = Number(process.argv[3])
  const endPage = Number(process.argv[4] ?? startPage)
  const doc = await parsePdf(file)
  for (const block of doc.blocks) {
    if (block.page === null || block.page < startPage || block.page > endPage) continue
    console.log(`[p${block.page} ${block.type}] ${block.text.slice(0, 200)}`)
  }
}
main()
