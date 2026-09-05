import { supabase } from '@/lib/supabase'

/** Every baseline a parent has set for a learner, keyed by subject_id. */
export async function fetchSubjectBaselines(learnerId: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('learner_subject_baselines')
    .select('subject_id, baseline_mastery')
    .eq('learner_id', learnerId)
  return new Map((data ?? []).map((row) => [row.subject_id, Number(row.baseline_mastery)]))
}

export async function setSubjectBaseline(learnerId: string, subjectId: string, baselineMastery: number): Promise<void> {
  const { error } = await supabase
    .from('learner_subject_baselines')
    .upsert(
      { learner_id: learnerId, subject_id: subjectId, baseline_mastery: baselineMastery, updated_at: new Date().toISOString() },
      { onConflict: 'learner_id,subject_id' },
    )
  if (error) throw error
}
