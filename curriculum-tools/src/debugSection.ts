/**
 * Diagnostic tool: shows how many topic candidates detectTopicCandidates()
 * found per grade for a given PDF, plus the raw blocks in an optional page
 * range — useful for working out why a real CAPS document is producing too
 * few (or zero) candidates for a grade you expected content for. Not part
 * of the import pipeline itself.
 *
 * Usage: npm run debug-section-detection -- <file.pdf> [minPage] [maxPage]
 */
import { parsePdf } from './parsers/pdfParser.js'
import { detectTopicCandidates } from './detectors/curriculumDetectors.js'

async function main() {
  const file = process.argv[2]
  const minPage = Number(process.argv[3] ?? 0)
  const maxPage = Number(process.argv[4] ?? 0)
  const doc = await parsePdf(file)
  const candidates = detectTopicCandidates(doc.blocks)
  console.log(`Total candidates (any grade): ${candidates.length}`)
  const byGrade = new Map<string, number>()
  for (const c of candidates) {
    const key = `${c.gradeNumber}`
    byGrade.set(key, (byGrade.get(key) ?? 0) + 1)
  }
  console.log('By grade:', Object.fromEntries(byGrade))

  if (maxPage > 0) {
    console.log(`\n--- Blocks pages ${minPage}-${maxPage} ---`)
    for (const b of doc.blocks) {
      if ((b.page ?? 0) >= minPage && (b.page ?? 0) <= maxPage) {
        console.log(`[${b.type}, p${b.page}] ${b.text.slice(0, 80)}`)
      }
    }
  }
}
main()
