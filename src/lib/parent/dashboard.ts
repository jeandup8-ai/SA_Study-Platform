import { supabase } from '@/lib/supabase'

function startOfWeekIso(): string {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay() // Monday-start week
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

export interface WeeklyStats {
  lessonsCompleted: number
  questionsAnswered: number
  studySeconds: number
}

export async function fetchWeeklyStats(learnerId: string): Promise<WeeklyStats> {
  const since = startOfWeekIso()

  const [{ count: lessonsCompleted }, { count: questionsAnswered }, { data: sessions }] = await Promise.all([
    supabase
      .from('learner_progress')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', learnerId)
      .eq('status', 'completed')
      .gte('completed_at', since),
    supabase
      .from('assessment_answers')
      .select('id, assessment_attempts!inner(learner_id)', { count: 'exact', head: true })
      .eq('assessment_attempts.learner_id', learnerId)
      .gte('answered_at', since),
    supabase.from('study_sessions').select('duration_seconds').eq('learner_id', learnerId).gte('started_at', since),
  ])

  const studySeconds = (sessions ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)

  return {
    lessonsCompleted: lessonsCompleted ?? 0,
    questionsAnswered: questionsAnswered ?? 0,
    studySeconds,
  }
}

export interface TopicAttention {
  topicId: string
  topicName: string
  masteryScore: number
}

export async function fetchAttentionNeeded(learnerId: string, limit = 3): Promise<TopicAttention[]> {
  const { data } = await supabase
    .from('mastery')
    .select('topic_id, mastery_score, topics(name)')
    .eq('learner_id', learnerId)
    .lt('mastery_score', 60)
    .order('mastery_score', { ascending: true })
    .limit(limit)

  return (data ?? [])
    .map((row) => ({
      topicId: row.topic_id,
      topicName: row.topics?.name ?? '—',
      masteryScore: Number(row.mastery_score),
    }))
    .filter((r) => r.topicName !== '—')
}
