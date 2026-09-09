import { supabase } from '@/lib/supabase'
import { isV2Lesson, getPracticeQuestions } from '@/lib/curriculum/lessonV2'
import { fetchQuestionsForTopic } from '@/lib/curriculum/questions'
import type { LanguageCode, Lesson } from '@/types/curriculum'

export interface PrintableQuestion {
  question: string
  answer: string
}

/**
 * Unified practice-set fetch for printing, spanning both content models: V2.3
 * lessons carry free-text practice questions directly on the lesson row
 * (see lib/curriculum/lessonV2.ts); older topics only have the graded
 * multiple-choice question bank. A printed worksheet doesn't care which
 * model produced the content, so this normalises both into the same
 * question/answer shape.
 */
export async function fetchPrintablePracticeSet(topicId: string, language: LanguageCode): Promise<PrintableQuestion[]> {
  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('topic_id', topicId)
    .order('sort_order')

  const v2Questions = (lessons ?? [])
    .filter((lesson): lesson is Lesson => isV2Lesson(lesson as Lesson))
    .flatMap((lesson) => getPracticeQuestions(lesson as Lesson, language))
    .map((q) => ({ question: q.question, answer: q.correct_answer }))

  if (v2Questions.length > 0) return v2Questions

  const graded = await fetchQuestionsForTopic({ topicId, language, limit: 10 })
  return graded.map((q) => ({
    question: q.prompt,
    answer: q.options.find((o) => o.is_correct)?.label ?? q.explanation ?? '—',
  }))
}
