import { supabase } from '@/lib/supabase'
import { localizedName } from '@/lib/i18n/localizedName'
import type { Topic, LanguageCode } from '@/types/curriculum'

export interface TopicWithProgress extends Topic {
  lessonCount: number
  masteryScore: number
  isBaseline: boolean
  illustrationUrl: string | null
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

  const { data: baselines } = await supabase
    .from('learner_topic_baselines')
    .select('topic_id, baseline_mastery')
    .eq('learner_id', learnerId)
    .in('topic_id', topicIds)
  const baselineByTopic = new Map((baselines ?? []).map((b) => [b.topic_id, Number(b.baseline_mastery)]))

  const { data: illustrations } = await supabase
    .from('media')
    .select('topic_id, url, created_at')
    .eq('media_type', 'image')
    .eq('approval_status', 'approved')
    .in('topic_id', topicIds)
    .order('created_at', { ascending: false })
  const illustrationByTopic = new Map<string, string>()
  for (const row of illustrations ?? []) {
    if (row.topic_id && row.url && !illustrationByTopic.has(row.topic_id)) {
      illustrationByTopic.set(row.topic_id, row.url)
    }
  }

  return topics.map((t) => {
    const realMastery = masteryByTopic.get(t.id)
    const baseline = baselineByTopic.get(t.id) ?? 0
    return {
      ...t,
      name: localizedName(t, language),
      lessonCount: lessonCountByTopic.get(t.id) ?? 0,
      masteryScore: realMastery ?? baseline,
      isBaseline: realMastery === undefined && baseline > 0,
      illustrationUrl: illustrationByTopic.get(t.id) ?? null,
    }
  })
}
