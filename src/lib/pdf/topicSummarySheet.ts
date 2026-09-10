import type { WorkedExample } from '@/lib/curriculum/lessonV2'
import type { KeyTerm } from '@/lib/curriculum/topicSummary'

const PAGE_MARGIN = 18
const PAGE_WIDTH = 210 // A4 portrait, mm
const PAGE_HEIGHT = 297
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const BRAND_TEAL: [number, number, number] = [13, 148, 136]

interface TopicSummaryLabels {
  brand: string
  keyTermsHeading: string
  summaryHeading: string
  workedExampleHeading: string
  aiGeneratedNotice: string
}

/**
 * A one-topic revision sheet in the spirit of what parents respond well to
 * in competitors' printable summaries: a clear title, short bulleted
 * sections instead of dense paragraphs, and key terms pulled out and made
 * visually distinct rather than buried in prose. Built entirely from this
 * app's own already-approved content (narration + worked example + the
 * verified terminology database) -- nothing sourced from anywhere else.
 *
 * No emoji here deliberately: jsPDF's built-in fonts don't carry emoji
 * glyphs, so section headers use bold coloured text + a rule instead, which
 * renders correctly everywhere a plain emoji character would show as a
 * broken box.
 *
 * jsPDF is dynamically imported (see practiceSheet.ts for why) so the
 * ~400KB dependency only loads when a parent actually clicks download.
 */
export async function generateTopicSummaryPdf(params: {
  subjectName: string
  topicName: string
  narrationParagraphs: string[]
  workedExample: WorkedExample | null
  keyTerms: KeyTerm[]
  labels: TopicSummaryLabels
}): Promise<void> {
  const { subjectName, topicName, narrationParagraphs, workedExample, keyTerms, labels } = params
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = PAGE_MARGIN

  function ensureSpace(needed: number) {
    if (y + needed > PAGE_HEIGHT - PAGE_MARGIN) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }

  function sectionHeading(text: string) {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...BRAND_TEAL)
    doc.text(text, PAGE_MARGIN, y)
    doc.setDrawColor(...BRAND_TEAL)
    doc.setLineWidth(0.6)
    doc.line(PAGE_MARGIN, y + 2, PAGE_WIDTH - PAGE_MARGIN, y + 2)
    doc.setTextColor(0)
    y += 9
  }

  function bullet(text: string, indent = 5) {
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent)
    ensureSpace(lines.length * 5.5 + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('•', PAGE_MARGIN, y)
    doc.text(lines, PAGE_MARGIN + indent, y)
    y += lines.length * 5.5 + 2
  }

  // --- Header ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND_TEAL)
  doc.text(labels.brand, PAGE_MARGIN, y)
  doc.setTextColor(0)
  y += 9

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  const titleLines = doc.splitTextToSize(topicName, CONTENT_WIDTH)
  doc.text(titleLines, PAGE_MARGIN, y)
  y += titleLines.length * 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(subjectName, PAGE_MARGIN, y)
  doc.setTextColor(0)
  y += 6

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(140)
  const noticeLines = doc.splitTextToSize(labels.aiGeneratedNotice, CONTENT_WIDTH)
  doc.text(noticeLines, PAGE_MARGIN, y)
  doc.setTextColor(0)
  y += noticeLines.length * 4 + 6

  // --- Key terms ---
  if (keyTerms.length > 0) {
    sectionHeading(labels.keyTermsHeading)
    for (const kt of keyTerms) {
      ensureSpace(6)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      const termWidth = doc.getTextWidth(`${kt.term}: `)
      doc.text(`${kt.term}:`, PAGE_MARGIN, y)
      doc.setFont('helvetica', 'normal')
      const defLines = doc.splitTextToSize(kt.definition, CONTENT_WIDTH - termWidth - 2)
      doc.text(defLines, PAGE_MARGIN + termWidth + 2, y)
      y += Math.max(1, defLines.length) * 5.5 + 2
    }
    y += 4
  }

  // --- Summary (narration broken into short bullet points) ---
  if (narrationParagraphs.length > 0) {
    sectionHeading(labels.summaryHeading)
    for (const paragraph of narrationParagraphs) {
      bullet(paragraph)
    }
    y += 4
  }

  // --- Worked example ---
  if (workedExample) {
    sectionHeading(labels.workedExampleHeading)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const problemLines = doc.splitTextToSize(workedExample.problem, CONTENT_WIDTH)
    ensureSpace(problemLines.length * 5.5 + 4)
    doc.text(problemLines, PAGE_MARGIN, y)
    y += problemLines.length * 5.5 + 3

    workedExample.solution_steps.forEach((step, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${step}`, CONTENT_WIDTH - 4)
      ensureSpace(lines.length * 5.5 + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      doc.text(lines, PAGE_MARGIN + 2, y)
      y += lines.length * 5.5 + 2
    })

    ensureSpace(12)
    doc.setFillColor(240, 253, 250)
    const answerLines = doc.splitTextToSize(workedExample.final_answer, CONTENT_WIDTH - 6)
    doc.rect(PAGE_MARGIN, y - 4, CONTENT_WIDTH, answerLines.length * 5.5 + 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BRAND_TEAL)
    doc.text(answerLines, PAGE_MARGIN + 3, y + 1)
    doc.setTextColor(0)
    y += answerLines.length * 5.5 + 8
  }

  const fileSafeTopic = topicName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  doc.save(`${fileSafeTopic || 'topic-summary'}.pdf`)
}
