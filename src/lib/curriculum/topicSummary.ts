import { supabase } from '@/lib/supabase'
import { isV2Lesson, getNarration, getWorkedExample, paragraphize, type WorkedExample } from '@/lib/curriculum/lessonV2'
import type { LanguageCode, Lesson } from '@/types/curriculum'

export interface KeyTerm {
  term: string
  definition: string
}

export interface TopicSummaryContent {
  narrationParagraphs: string[]
  workedExample: WorkedExample | null
  keyTerms: KeyTerm[]
}

/**
 * Pulls together everything a printable "topic summary" sheet needs, built
 * entirely from content this app already owns (AI-authored narration grounded
 * in the official CAPS documents, plus the verified terminology database) --
 * no new AI generation step, so a summary can be produced instantly and for
 * free at download time.
 */
export async function fetchTopicSummaryContent(topicId: string, language: LanguageCode): Promise<TopicSummaryContent> {
  const { data: topic } = await supabase.from('topics').select('subject_id').eq('id', topicId).maybeSingle()

  const [{ data: lessons }, { data: terminology }] = await Promise.all([
    supabase.from('lessons').select('*').eq('topic_id', topicId).order('sort_order').limit(1),
    topic
      ? supabase
          .from('terminology')
          .select('term, translation, definition')
          .eq('subject_id', topic.subject_id)
          .eq('language', language)
          .eq('verified', true)
          .limit(12)
      : Promise.resolve({ data: [] as { term: string; translation: string | null; definition: string | null }[] }),
  ])

  const lesson = lessons?.[0] as Lesson | undefined
  const narrationParagraphs = lesson && isV2Lesson(lesson) ? paragraphize(getNarration(lesson, language)) : []
  const workedExample = lesson && isV2Lesson(lesson) ? getWorkedExample(lesson, language) : null

  const keyTerms: KeyTerm[] = (terminology ?? [])
    .map((t) => ({
      term: language === 'af' && t.translation ? t.translation : t.term,
      definition: t.definition ?? '',
    }))
    .filter((t) => t.definition.length > 0)

  return { narrationParagraphs, workedExample, keyTerms }
}
