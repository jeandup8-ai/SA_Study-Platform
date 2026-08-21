/**
 * Diagnostic tool: dumps every block up to a given page, in order — useful
 * for checking a document's front matter for anything that could trip
 * matchSection() falsely (e.g. a contents-page listing every grade/term
 * combination) before trusting a new section-header pattern. Not part of
 * the import pipeline itself.
 *
 * Usage: npm run inspect-early-pages -- <file.pdf> [maxPage]
 */
import { parsePdf } from './parsers/pdfParser.js'

async function main() {
  const file = process.argv[2]
  const maxPage = Number(process.argv[3] ?? 5)
  const doc = await parsePdf(file)
  for (const b of doc.blocks) {
    if ((b.page ?? 999) <= maxPage) console.log(`[${b.type}, p${b.page}] ${b.text.slice(0, 90)}`)
  }
}
main()
