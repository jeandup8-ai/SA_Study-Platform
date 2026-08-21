/**
 * Diagnostic tool: prints every short block in a PDF that mentions a grade
 * number, so you can see the actual section-header format a new source
 * document uses before adding a pattern for it to curriculumDetectors.ts's
 * matchSection(). Not part of the import pipeline itself.
 *
 * Usage: npm run inspect-grades -- <file.pdf>
 */
import { parsePdf } from './parsers/pdfParser.js'

async function main() {
  const file = process.argv[2]
  const doc = await parsePdf(file)
  const gradeLike = doc.blocks.filter((b) => /grade\s*[4-9]/i.test(b.text) && b.text.length < 80)
  console.log(`Found ${gradeLike.length} short grade-like blocks (of ${doc.blocks.length} total):`)
  for (const b of gradeLike.slice(0, 60)) {
    console.log(`  [${b.type}, p${b.page}] "${b.text}"`)
  }
}
main()
