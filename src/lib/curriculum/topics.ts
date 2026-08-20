import { supabase } from '@/lib/supabase'
import { localizedName } from '@/lib/i18n/localizedName'
import type { Topic, LanguageCode } from '@/types/curriculum'

export interface TopicWithProgress extends Topic {
  lessonCount: number
  masteryScore: number
}

export async function fetchTopicsWithProgress(
  subjectId: string,
  gradeId: string,
  learnerId: string,
  language: LanguageCode = 'en',
): Promise<TopicWithProgress[]> {
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('grade_id', gradeId)
    .order('sort_order')
  if (!topics || topics.length === 0) return []

  const topicIds = topics.map((t) => t.id)

  const { data: lessons } = await supabase.from('lessons').select('id, topic_id').in('topic_id', topicIds)
  const lessonCountByTopic = new Map<string, number>()
  for (const l of lessons ?? []) {
    lessonCountByTopic.set(l.topic_id, (lessonCountByTopic.get(l.topic_id) ?? 0) + 1)
  }

  const { data: mastery } = await supabase
    .from('mastery')
    .select('topic_id, mastery_score')
    .eq('learner_id', learnerId)
    .in('topic_id', topicIds)
  const masteryByTopic = new Map((mastery ?? []).map((m) => [m.topic_id, Number(m.mastery_score)]))

  return topics.map((t) => ({
    ...t,
    name: localizedName(t, language),
    lessonCount: lessonCountByTopic.get(t.id) ?? 0,
    masteryScore: masteryByTopic.get(t.id) ?? 0,
  }))
}
