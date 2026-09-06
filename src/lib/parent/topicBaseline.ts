import { supabase } from '@/lib/supabase'

export async function fetchTopicBaselines(learnerId: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('learner_topic_baselines')
    .select('topic_id, baseline_mastery')
    .eq('learner_id', learnerId)
  return new Map((data ?? []).map((row) => [row.topic_id, Number(row.baseline_mastery)]))
}

export async function setTopicBaseline(learnerId: string, topicId: string, baselineMastery: number): Promise<void> {
  const { error } = await supabase
    .from('learner_topic_baselines')
    .upsert(
      { learner_id: learnerId, topic_id: topicId, baseline_mastery: baselineMastery, updated_at: new Date().toISOString() },
      { onConflict: 'learner_id,topic_id' },
    )
  if (error) throw error
}

export async function setTopicBaselines(
  learnerId: string,
  entries: { topicId: string; baselineMastery: number }[],
): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({
    learner_id: learnerId,
    topic_id: e.topicId,
    baseline_mastery: e.baselineMastery,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('learner_topic_baselines').upsert(rows, { onConflict: 'learner_id,topic_id' })
  if (error) throw error
}
