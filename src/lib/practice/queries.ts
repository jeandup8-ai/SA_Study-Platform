import { supabase } from '@/lib/supabase'
import type { QuestionWithOptions } from '@/components/lesson/QuestionRunner'
import type { Database } from '@/types/database'
import type { LanguageCode } from '@/types/curriculum'

type PracticeTestRow = Database['public']['Tables']['practice_tests']['Row']

export interface PracticeSubjectSummary {
  subjectId: string
  slug: string
  name: string
  nameAf: string | null
  testCount: number
  questionCount: number
  languages: LanguageCode[]
}

export interface PracticeTestSummary {
  id: string
  slug: string
  titleEn: string
  titleAf: string | null
  summaryEn: string | null
  summaryAf: string | null
  questionCount: number
  languages: LanguageCode[]
}

export interface PracticeTestDetail extends PracticeTestSummary {
  gradeNumber: number
  subjectName: string
  subjectNameAf: string | null
  subjectSlug: string
  topicId: string | null
  questions: QuestionWithOptions[]
  /** Language the questions actually came back in, which may not be the one
   * asked for -- an Afrikaans visitor still gets the English test rather than
   * an empty page. */
  servedLanguage: LanguageCode
}

/** Rows joined onto every practice-test read: the questions in the test, and
 * enough of each question to both count by language and render it. */
const TEST_WITH_QUESTIONS = `
  id, slug, title_en, title_af, summary_en, summary_af, sort_order, topic_id,
  practice_test_questions (
    sort_order,
    questions ( *, question_options ( * ) )
  )
`

type JoinedTest = PracticeTestRow & {
  practice_test_questions: {
    sort_order: number
    questions: (Database['public']['Tables']['questions']['Row'] & {
      question_options: Database['public']['Tables']['question_options']['Row'][]
    }) | null
  }[]
}

function languagesIn(test: JoinedTest): LanguageCode[] {
  const set = new Set<LanguageCode>()
  for (const link of test.practice_test_questions) {
    if (link.questions) set.add(link.questions.language)
  }
  return [...set].sort()
}

/** Questions are stored one row per language, so a test that exists in both
 * languages holds twice as many rows as a learner ever sees. Count the larger
 * single-language set, which is what "12 questions" means to a visitor. */
function questionCountFor(test: JoinedTest): number {
  const byLanguage = new Map<LanguageCode, number>()
  for (const link of test.practice_test_questions) {
    const lang = link.questions?.language
    if (lang) byLanguage.set(lang, (byLanguage.get(lang) ?? 0) + 1)
  }
  return Math.max(0, ...byLanguage.values())
}

export async function fetchPracticeGradeCounts(): Promise<Map<number, number>> {
  const { data } = await supabase
    .from('practice_tests')
    .select('id, grades ( grade_number )')
    .eq('is_published', true)

  const counts = new Map<number, number>()
  for (const row of data ?? []) {
    const gradeNumber = (row as { grades: { grade_number: number } | null }).grades?.grade_number
    if (gradeNumber == null) continue
    counts.set(gradeNumber, (counts.get(gradeNumber) ?? 0) + 1)
  }
  return counts
}

export async function fetchPracticeSubjects(gradeNumber: number): Promise<PracticeSubjectSummary[]> {
  const { data: grade } = await supabase.from('grades').select('id').eq('grade_number', gradeNumber).maybeSingle()
  if (!grade) return []

  const { data } = await supabase
    .from('practice_tests')
    .select(`${TEST_WITH_QUESTIONS}, subjects ( id, name, name_af, slug )`)
    .eq('grade_id', grade.id)
    .eq('is_published', true)

  const bySubject = new Map<string, PracticeSubjectSummary>()
  for (const row of (data ?? []) as unknown as (JoinedTest & {
    subjects: { id: string; name: string; name_af: string | null; slug: string } | null
  })[]) {
    if (!row.subjects) continue
    const existing = bySubject.get(row.subjects.id) ?? {
      subjectId: row.subjects.id,
      slug: row.subjects.slug,
      name: row.subjects.name,
      nameAf: row.subjects.name_af,
      testCount: 0,
      questionCount: 0,
      languages: [] as LanguageCode[],
    }
    existing.testCount += 1
    existing.questionCount += questionCountFor(row)
    existing.languages = [...new Set([...existing.languages, ...languagesIn(row)])].sort()
    bySubject.set(row.subjects.id, existing)
  }

  return [...bySubject.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchPracticeTests(gradeNumber: number, subjectSlug: string): Promise<PracticeTestSummary[]> {
  const [{ data: grade }, { data: subject }] = await Promise.all([
    supabase.from('grades').select('id').eq('grade_number', gradeNumber).maybeSingle(),
    supabase.from('subjects').select('id').eq('slug', subjectSlug).maybeSingle(),
  ])
  if (!grade || !subject) return []

  const { data } = await supabase
    .from('practice_tests')
    .select(TEST_WITH_QUESTIONS)
    .eq('grade_id', grade.id)
    .eq('subject_id', subject.id)
    .eq('is_published', true)
    .order('sort_order')

  return ((data ?? []) as unknown as JoinedTest[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    titleEn: row.title_en,
    titleAf: row.title_af,
    summaryEn: row.summary_en,
    summaryAf: row.summary_af,
    questionCount: questionCountFor(row),
    languages: languagesIn(row),
  }))
}

export async function fetchPracticeTest(
  gradeNumber: number,
  subjectSlug: string,
  testSlug: string,
  language: LanguageCode,
): Promise<PracticeTestDetail | null> {
  const [{ data: grade }, { data: subject }] = await Promise.all([
    supabase.from('grades').select('id, grade_number').eq('grade_number', gradeNumber).maybeSingle(),
    supabase.from('subjects').select('id, name, name_af, slug').eq('slug', subjectSlug).maybeSingle(),
  ])
  if (!grade || !subject) return null

  const { data } = await supabase
    .from('practice_tests')
    .select(TEST_WITH_QUESTIONS)
    .eq('grade_id', grade.id)
    .eq('subject_id', subject.id)
    .eq('slug', testSlug)
    .eq('is_published', true)
    .maybeSingle()
  if (!data) return null

  const test = data as unknown as JoinedTest
  const available = languagesIn(test)
  const servedLanguage: LanguageCode = available.includes(language) ? language : (available[0] ?? 'en')

  const questions = test.practice_test_questions
    .filter((link) => link.questions?.language === servedLanguage)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => {
      const question = link.questions!
      const { question_options, ...rest } = question
      return { ...rest, options: [...question_options].sort((a, b) => a.sort_order - b.sort_order) }
    })

  return {
    id: test.id,
    slug: test.slug,
    titleEn: test.title_en,
    titleAf: test.title_af,
    summaryEn: test.summary_en,
    summaryAf: test.summary_af,
    questionCount: questions.length,
    languages: available,
    gradeNumber: grade.grade_number,
    subjectName: subject.name,
    subjectNameAf: subject.name_af,
    subjectSlug: subject.slug,
    topicId: test.topic_id,
    questions,
    servedLanguage,
  }
}

/** Every published practice URL, for the sitemap and for the "more tests" rail. */
export async function fetchAllPracticeUrls(): Promise<
  { gradeNumber: number; subjectSlug: string; testSlug: string }[]
> {
  const { data } = await supabase
    .from('practice_tests')
    .select('slug, grades ( grade_number ), subjects ( slug )')
    .eq('is_published', true)

  return ((data ?? []) as unknown as {
    slug: string
    grades: { grade_number: number } | null
    subjects: { slug: string } | null
  }[])
    .filter((row) => row.grades && row.subjects)
    .map((row) => ({
      gradeNumber: row.grades!.grade_number,
      subjectSlug: row.subjects!.slug,
      testSlug: row.slug,
    }))
}

export function practiceTestTitle(test: { titleEn: string; titleAf: string | null }, language: LanguageCode): string {
  return language === 'af' && test.titleAf ? test.titleAf : test.titleEn
}

export function practiceTestSummary(
  test: { summaryEn: string | null; summaryAf: string | null },
  language: LanguageCode,
): string | null {
  return language === 'af' && test.summaryAf ? test.summaryAf : test.summaryEn
}
