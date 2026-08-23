import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface PageRequest {
  documentId: string
  filePath: string
  pages: number[]
}

const requests: PageRequest[] = [
  {
    documentId: 'dbe-caps-math-ip',
    filePath: '../../curriculum/sources/caps/CAPS_Mathematics_Grades4-6.pdf',
    pages: [19, 24, 30, 36, 39, 41, 43, 48, 52],
  },
  {
    documentId: 'dbe-caps-math-sp',
    filePath: '../../curriculum/sources/caps/CAPS_Mathematics_Grade7-9.pdf',
    pages: [21, 27],
  },
  {
    documentId: 'dbe-caps-creativearts-sp',
    filePath: '../../curriculum/sources/caps/CAPS_Creative_Arts_Grade7-9.pdf',
    pages: [28, 29, 30, 31, 40, 41, 42, 43, 52, 53, 54, 55, 56, 57, 70, 71, 73],
  },
  {
    documentId: 'dbe-caps-socsci-ip',
    filePath: '../../curriculum/sources/caps/CAPS_Social_Sciences_Grades4-6.pdf',
    pages: [12, 13],
  },
  {
    documentId: 'dbe-caps-humansocsci-sp',
    filePath: '../../curriculum/sources/caps/CAPS_Human_Social_Sciences_Grade7-9.pdf',
    pages: [11, 12],
  },
  {
    documentId: 'dbe-caps-lifeskills-ip',
    filePath: '../../curriculum/sources/caps/CAPS_Life_Skills_Grades4-6.pdf',
    pages: [20, 21, 22, 23, 24, 26, 28, 29, 30, 31, 50, 51, 52, 53, 54, 55],
  },
]

async function dumpDocument(req: PageRequest): Promise<Record<number, string>> {
  const data = new Uint8Array(fs.readFileSync(path.resolve(__dirname, req.filePath)))
  const doc = await getDocument({ data }).promise
  const out: Record<number, string> = {}
  for (const pageNum of req.pages) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => item.str).join(' ')
    out[pageNum] = text.replace(/\s+/g, ' ').trim()
  }
  return out
}

async function main() {
  const result: Record<string, Record<number, string>> = {}
  for (const req of requests) {
    console.error(`Extracting ${req.documentId}: pages ${req.pages.join(',')}`)
    result[req.documentId] = await dumpDocument(req)
  }
  fs.writeFileSync(
    path.resolve(__dirname, '../../curriculum/generated-lessons/full-page-text.json'),
    JSON.stringify(result, null, 2),
  )
  console.error('Wrote full-page-text.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
