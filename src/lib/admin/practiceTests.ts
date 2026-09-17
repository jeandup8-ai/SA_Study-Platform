import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { LanguageCode } from '@/types/curriculum'

type QuestionRow = Database['public']['Tables']['questions']['Row']
type OptionRow = Database['public']['Tables']['question_options']['Row']

export interface AdminPracticeQuestion extends QuestionRow {
  options: OptionRow[]
  sortOrder: number
}

export interface AdminPracticeTest {
  id: string
  slug: string
  titleEn: string
  titleAf: string | null
  summaryEn: string | null
  isPublished: boolean
  gradeNumber: number | null
  subjectName: string | null
  subjectSlug: string | null
  questions: AdminPracticeQuestion[]
  /** True when no question is still waiting on a reviewer. */
  allQuestionsApproved: boolean
  /** Questions whose options do not describe exactly one correct answer --
   * a data error that would show a learner a test it is impossible to pass. */
  brokenQuestionIds: string[]
}

const SELECT = `
  id, slug, title_en, title_af, summary_en, is_published, sort_order,
  grades ( grade_number ),
  subjects ( name, slug ),
  practice_test_questions ( sort_order, questions ( *, question_options ( * ) ) )
`

type JoinedRow = {
  id: string
  slug: string
  title_en: string
  title_af: string | null
  summary_en: string | null
  is_published: boolean
  sort_order: number
  grades: { grade_number: number } | null
  subjects: { name: string; slug: string } | null
  practice_test_questions: {
    sort_order: number
    questions: (QuestionRow & { question_options: OptionRow[] }) | null
  }[]
}

export async function fetchAdminPracticeTests(): Promise<AdminPracticeTest[]> {
  const { data, error } = await supabase.from('practice_tests').select(SELECT).order('sort_order')
  if (error) throw error

  return ((data ?? []) as unknown as JoinedRow[])
    .map((row) => {
      const questions: AdminPracticeQuestion[] = row.practice_test_questions
        .filter((link) => link.questions)
        .map((link) => {
          const { question_options, ...rest } = link.questions!
          return {
            ...rest,
            options: [...question_options].sort((a, b) => a.sort_order - b.sort_order),
            sortOrder: link.sort_order,
          }
        })
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.language.localeCompare(b.language) || a.prompt.localeCompare(b.prompt),
        )

      return {
        id: row.id,
        slug: row.slug,
        titleEn: row.title_en,
        titleAf: row.title_af,
        summaryEn: row.summary_en,
        isPublished: row.is_published,
        gradeNumber: row.grades?.grade_number ?? null,
        subjectName: row.subjects?.name ?? null,
        subjectSlug: row.subjects?.slug ?? null,
        questions,
        allQuestionsApproved:
          questions.length > 0 && questions.every((q) => q.content_workflow_status === 'PUBLISHED'),
        brokenQuestionIds: questions
          .filter((q) => q.options.filter((o) => o.is_correct).length !== 1)
          .map((q) => q.id),
      }
    })
    .sort(
      (a, b) =>
        (a.gradeNumber ?? 0) - (b.gradeNumber ?? 0) ||
        (a.subjectName ?? '').localeCompare(b.subjectName ?? '') ||
        a.titleEn.localeCompare(b.titleEn),
    )
}

/** Approving a test approves its questions in the same breath -- they are what
 * the public page actually renders, and leaving them unapproved would publish
 * an empty test. */
export async function setPracticeTestPublished(test: AdminPracticeTest, published: boolean): Promise<void> {
  if (published && test.brokenQuestionIds.length > 0) {
    throw new Error('This test has questions without exactly one correct answer. Fix those before publishing.')
  }

  const questionIds = test.questions.map((q) => q.id)
  if (questionIds.length > 0) {
    const { error } = await supabase
      .from('questions')
      .update({ content_workflow_status: published ? 'PUBLISHED' : 'REVIEW_REQUIRED' })
      .in('id', questionIds)
    if (error) throw error
  }

  const { error } = await supabase
    .from('practice_tests')
    .update({ is_published: published, updated_at: new Date().toISOString() })
    .eq('id', test.id)
  if (error) throw error
}

/** Drops one question from a test without deleting the question itself, for the
 * case where a reviewer rejects a single item rather than the whole test. */
export async function removeQuestionFromTest(testId: string, questionId: string): Promise<void> {
  const { error } = await supabase
    .from('practice_test_questions')
    .delete()
    .eq('practice_test_id', testId)
    .eq('question_id', questionId)
  if (error) throw error
}

export function countByLanguage(questions: AdminPracticeQuestion[]): Record<LanguageCode, number> {
  const counts = {} as Record<LanguageCode, number>
  for (const q of questions) counts[q.language] = (counts[q.language] ?? 0) + 1
  return counts
}
