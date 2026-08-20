import { readFile } from 'node:fs/promises'
import type { ExtractedBlock, ExtractedDocument } from './types.js'

/** Plain text has no structure to preserve, so this is deliberately the
 * simplest parser: one block per non-blank line, with a heading guess based
 * only on the line being short and ALL CAPS (a common convention in plain-text
 * exports of official documents, e.g. "TERM 1" or "TOPIC: FRACTIONS"). */
export async function parseText(filePath: string): Promise<ExtractedDocument> {
  const raw = await readFile(filePath, 'utf-8')
  const blocks: ExtractedBlock[] = []
  let lineNumber = 0

  for (const line of raw.split(/\r?\n/)) {
    lineNumber++
    const text = line.trim()
    if (!text) continue

    const looksLikeHeading = text.length < 80 && text === text.toUpperCase() && /[A-Z]/.test(text)

    blocks.push({
      type: looksLikeHeading ? 'heading' : 'paragraph',
      text,
      page: null,
      headingLevel: looksLikeHeading ? 1 : null,
      tableCells: null,
      sourceLocation: `Line ${lineNumber}`,
    })
  }

  return { sourceFormat: 'txt', pageCount: null, blocks }
}
