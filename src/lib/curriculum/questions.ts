import { supabase } from '@/lib/supabase'
import type { QuestionWithOptions } from '@/components/lesson/QuestionRunner'
import type { LanguageCode } from '@/types/curriculum'

export async function fetchQuestionsForTopic(params: {
  topicId: string
  language: LanguageCode
  limit: number
}): Promise<QuestionWithOptions[]> {
  const { topicId, language, limit } = params
  let { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('topic_id', topicId)
    .eq('language', language)
    .limit(limit)

  if (!questions || questions.length === 0) {
    const fallback = await supabase.from('questions').select('*').eq('topic_id', topicId).eq('language', 'en').limit(limit)
    questions = fallback.data
  }
  if (!questions || questions.length === 0) return []

  const { data: options } = await supabase
    .from('question_options')
    .select('*')
    .in(
      'question_id',
      questions.map((q) => q.id),
    )
    .order('sort_order')

  return questions.map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id),
  }))
}

export async function fetchQuestionsForSubject(params: {
  subjectId: string
  gradeId: string
  language: LanguageCode
  limit: number
}): Promise<QuestionWithOptions[]> {
  const { subjectId, gradeId, language, limit } = params
  let { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('grade_id', gradeId)
    .eq('language', language)
    .limit(limit)

  if (!questions || questions.length === 0) {
    const fallback = await supabase
      .from('questions')
      .select('*')
      .eq('subject_id', subjectId)
      .eq('grade_id', gradeId)
      .eq('language', 'en')
      .limit(limit)
    questions = fallback.data
  }
  if (!questions || questions.length === 0) return []

  const { data: options } = await supabase
    .from('question_options')
    .select('*')
    .in(
      'question_id',
      questions.map((q) => q.id),
    )
    .order('sort_order')

  return questions.map((q) => ({
    ...q,
    options: (options ?? []).filter((o) => o.question_id === q.id),
  }))
}

export async function fetchMiniQuizForLesson(
  lessonId: string,
  language: LanguageCode,
): Promise<{ assessmentId: string | null; questions: QuestionWithOptions[] }> {
  const { data: assessment } = await supabase
    .from('assessments')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('type', 'mini_quiz')
    .maybeSingle()

  if (!assessment) return { assessmentId: null, questions: [] }

  const { data: assessmentQuestions } = await supabase
    .from('assessment_questions')
    .select('question_id, sort_order')
    .eq('assessment_id', assessment.id)
    .order('sort_order')

  const questionIds = (assessmentQuestions ?? []).map((r) => r.question_id)
  if (questionIds.length === 0) return { assessmentId: assessment.id, questions: [] }

  let { data: questions } = await supabase.from('questions').select('*').in('id', questionIds).eq('language', language)
  if (!questions || questions.length === 0) {
    const fallback = await supabase.from('questions').select('*').in('id', questionIds).eq('language', 'en')
    questions = fallback.data
  }
  const { data: options } = await supabase.from('question_options').select('*').in('question_id', questionIds).order('sort_order')

  const ordered = questionIds
    .map((id) => (questions ?? []).find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))

  return {
    assessmentId: assessment.id,
    questions: ordered.map((q) => ({
      ...q,
      options: (options ?? []).filter((o) => o.question_id === q.id),
    })),
  }
}
