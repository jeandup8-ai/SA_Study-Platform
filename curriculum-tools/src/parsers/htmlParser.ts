import { readFile } from 'node:fs/promises'
import { htmlToBlocks } from './htmlToBlocks.js'
import type { ExtractedDocument } from './types.js'

export async function parseHtml(filePath: string): Promise<ExtractedDocument> {
  const html = await readFile(filePath, 'utf-8')
  const blocks = htmlToBlocks(html, 'HTML')
  return { sourceFormat: 'html', pageCount: null, blocks }
}
