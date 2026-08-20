import { supabase } from '@/lib/supabase'

/**
 * IEB is not a separate curriculum here — it is an assessment-style overlay
 * (application / reasoning / critical thinking / unfamiliar-context framing)
 * on top of the same CAPS topics. This score is deliberately kept separate
 * from CAPS topic mastery so a parent can see "knows the content" vs "can
 * apply it under IEB-style conditions" as two different numbers (spec
 * section 17's worked example: CAPS mastery 78%, IEB application 64%).
 */
export async function computeIebApplicationScore(learnerId: string, subjectId: string): Promise<number | null> {
  const { data: applicationSkill } = await supabase.from('skills').select('id').eq('code', 'application').maybeSingle()
  if (!applicationSkill) return null

  const { data } = await supabase
    .from('learner_skill_mastery')
    .select('mastery_score')
    .eq('learner_id', learnerId)
    .eq('subject_id', subjectId)
    .eq('skill_id', applicationSkill.id)

  if (!data || data.length === 0) return null
  return data.reduce((sum, row) => sum + Number(row.mastery_score), 0) / data.length
}
