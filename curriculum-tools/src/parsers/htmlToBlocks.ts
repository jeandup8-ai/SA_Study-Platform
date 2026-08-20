import * as cheerio from 'cheerio'
import type { ExtractedBlock } from './types.js'

/** Shared by the DOCX parser (mammoth converts .docx -> HTML first) and the
 * HTML parser directly — one real implementation of "HTML structure ->
 * ExtractedBlock[]" rather than two half-implementations. */
export function htmlToBlocks(html: string, sourceLabel: string): ExtractedBlock[] {
  const $ = cheerio.load(html)
  const blocks: ExtractedBlock[] = []

  $('h1, h2, h3, h4, h5, h6, p, table, li').each((_, el) => {
    const tag = el.tagName.toLowerCase()

    if (tag === 'table') {
      const tableCells: ExtractedBlock['tableCells'] = []
      $(el)
        .find('tr')
        .each((rowIndex, row) => {
          $(row)
            .find('td, th')
            .each((colIndex, cell) => {
              const text = $(cell).text().trim()
              if (text) tableCells!.push({ text, rowIndex, colIndex })
            })
        })
      if (tableCells.length > 0) {
        blocks.push({
          type: 'table',
          text: tableCells.map((c) => c.text).join(' | '),
          page: null,
          headingLevel: null,
          tableCells,
          sourceLocation: `${sourceLabel}, table`,
        })
      }
      return
    }

    const text = $(el).text().trim()
    if (!text) return

    if (/^h[1-6]$/.test(tag)) {
      blocks.push({
        type: 'heading',
        text,
        page: null,
        headingLevel: Number(tag[1]),
        tableCells: null,
        sourceLocation: `${sourceLabel}, heading "${text.slice(0, 40)}"`,
      })
    } else if (tag === 'li') {
      blocks.push({
        type: 'list_item',
        text,
        page: null,
        headingLevel: null,
        tableCells: null,
        sourceLocation: sourceLabel,
      })
    } else {
      blocks.push({
        type: 'paragraph',
        text,
        page: null,
        headingLevel: null,
        tableCells: null,
        sourceLocation: sourceLabel,
      })
    }
  })

  return blocks
}
