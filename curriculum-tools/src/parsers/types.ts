/**
 * Common shape every parser (PDF/DOCX/TXT/HTML) normalises into, so the
 * detectors and importer downstream don't need to know which format the
 * source document was. Structure (headings, tables, page numbers) is
 * preserved deliberately — curriculum documents are table-heavy (term/topic
 * grids), and discarding that structure during extraction would make
 * accurate topic/term detection much harder later.
 */

export type ExtractedBlockType = 'heading' | 'paragraph' | 'table' | 'list_item'

export interface ExtractedTableCell {
  text: string
  rowIndex: number
  colIndex: number
}

export interface ExtractedBlock {
  type: ExtractedBlockType
  text: string
  /** 1 for the first page/section; PDFs and DOCX both support real page numbers.
   * HTML/TXT sources have no native pagination, so this is left null for them. */
  page: number | null
  /** Heading level (1 = top) when type === 'heading', else null. */
  headingLevel: number | null
  /** Populated only when type === 'table'. */
  tableCells: ExtractedTableCell[] | null
  /** Best-effort "where in the document" pointer for a human reviewer to check
   * this extracted block against the original file — e.g. "Page 12, Table 3"
   * or "Section 4.2". Never a substitute for reading the source. */
  sourceLocation: string
}

export interface ExtractedDocument {
  sourceFormat: 'pdf' | 'docx' | 'txt' | 'html'
  /** Total page count if known (PDF/DOCX); null for txt/html. */
  pageCount: number | null
  blocks: ExtractedBlock[]
}
