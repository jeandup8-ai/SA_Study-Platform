import mammoth from 'mammoth'
import { htmlToBlocks } from './htmlToBlocks.js'
import type { ExtractedDocument } from './types.js'

/** Real DOCX extraction via mammoth (converts to structural HTML, preserving
 * headings/tables/lists), then normalised through the same HTML->blocks path
 * the HTML parser uses. DOCX has no native page numbers once converted this
 * way, so `page` stays null for every block — source_page must be filled in
 * by a human reviewer for DOCX-sourced records. */
export async function parseDocx(filePath: string): Promise<ExtractedDocument> {
  const result = await mammoth.convertToHtml({ path: filePath })
  const blocks = htmlToBlocks(result.value, 'DOCX')
  return { sourceFormat: 'docx', pageCount: null, blocks }
}
