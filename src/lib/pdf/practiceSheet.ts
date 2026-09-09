import type { PrintableQuestion } from '@/lib/curriculum/printable'

const PAGE_MARGIN = 18
const PAGE_WIDTH = 210 // A4 portrait, mm
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

interface PracticeSheetLabels {
  brand: string
  practiceSheetTitle: string
  answerMemoTitle: string
  questionLabel: string // e.g. "Question" / "Vraag" -- gets a number appended
  writeYourAnswer: string
}

/**
 * Generates a two-part printable PDF: a practice sheet with numbered
 * questions and blank space to write on paper, followed by a separate
 * answer-memo page. Entirely client-side (no server round trip) since the
 * question/answer text is already in memory by the time a parent clicks
 * "download" -- this mirrors WorksheetCloud's printable-worksheet option for
 * families who want screen-free practice.
 *
 * jsPDF is dynamically imported here rather than at module scope: this app
 * doesn't route-split (see src/App.tsx), so a static import would add
 * jsPDF's ~400KB (it pulls in html2canvas/dompurify for features this app
 * never uses, like rendering live DOM to PDF) to the one bundle every visitor
 * downloads, just to serve the minority who ever click "download sheet".
 */
export async function generatePracticeSheetPdf(params: {
  subjectName: string
  topicName: string
  questions: PrintableQuestion[]
  labels: PracticeSheetLabels
}): Promise<void> {
  const { subjectName, topicName, questions, labels } = params
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = PAGE_MARGIN
  function ensureSpace(needed: number) {
    if (y + needed > 297 - PAGE_MARGIN) {
      doc.addPage()
      y = PAGE_MARGIN
    }
  }
  function heading(text: string) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(text, PAGE_MARGIN, y)
    y += 10
  }
  function subheading(text: string) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(text, PAGE_MARGIN, y)
    doc.setTextColor(0)
    y += 10
  }

  // --- Practice sheet ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(13, 148, 136) // brand teal
  doc.text(labels.brand, PAGE_MARGIN, y)
  doc.setTextColor(0)
  y += 8
  heading(labels.practiceSheetTitle)
  subheading(`${subjectName} · ${topicName}`)
  y += 2

  questions.forEach((q, i) => {
    const lines = doc.splitTextToSize(`${labels.questionLabel} ${i + 1}: ${q.question}`, CONTENT_WIDTH)
    ensureSpace(lines.length * 6 + 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(lines, PAGE_MARGIN, y)
    y += lines.length * 6 + 3

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(140)
    doc.text(labels.writeYourAnswer, PAGE_MARGIN, y)
    doc.setTextColor(0)
    y += 5
    doc.setDrawColor(210)
    doc.line(PAGE_MARGIN, y + 10, PAGE_WIDTH - PAGE_MARGIN, y + 10)
    doc.line(PAGE_MARGIN, y + 18, PAGE_WIDTH - PAGE_MARGIN, y + 18)
    y += 26
  })

  // --- Answer memo (separate page, so it can be kept away from the child) ---
  doc.addPage()
  y = PAGE_MARGIN
  heading(labels.answerMemoTitle)
  subheading(`${subjectName} · ${topicName}`)
  y += 2

  questions.forEach((q, i) => {
    const lines = doc.splitTextToSize(`${labels.questionLabel} ${i + 1}: ${q.answer}`, CONTENT_WIDTH)
    ensureSpace(lines.length * 6 + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(lines, PAGE_MARGIN, y)
    y += lines.length * 6 + 4
  })

  const fileSafeTopic = topicName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  doc.save(`${fileSafeTopic || 'practice-sheet'}.pdf`)
}
