import { supabase } from '@/lib/supabase'

export interface ExamReadiness {
  readinessScore: number
  strong: { topicId: string; name: string; score: number }[]
  needsRevision: { topicId: string; name: string; score: number }[]
  weak: { topicId: string; name: string; score: number }[]
}

export async function computeExamReadiness(learnerId: string, subjectId: string, gradeId: string): Promise<ExamReadiness> {
  const { data: topics } = await supabase.from('topics').select('id, name').eq('subject_id', subjectId).eq('grade_id', gradeId)
  const topicList = topics ?? []
  if (topicList.length === 0) {
    return { readinessScore: 0, strong: [], needsRevision: [], weak: [] }
  }

  const { data: masteryRows } = await supabase
    .from('mastery')
    .select('topic_id, mastery_score')
    .eq('learner_id', learnerId)
    .in(
      'topic_id',
      topicList.map((t) => t.id),
    )
  const scoreByTopic = new Map((masteryRows ?? []).map((m) => [m.topic_id, Number(m.mastery_score)]))

  const entries = topicList.map((t) => ({ topicId: t.id, name: t.name, score: scoreByTopic.get(t.id) ?? 0 }))
  const readinessScore = entries.reduce((sum, e) => sum + e.score, 0) / entries.length

  return {
    readinessScore,
    strong: entries.filter((e) => e.score >= 80),
    needsRevision: entries.filter((e) => e.score >= 50 && e.score < 80),
    weak: entries.filter((e) => e.score < 50),
  }
}
