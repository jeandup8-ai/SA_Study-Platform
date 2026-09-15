import { supabase } from '@/lib/supabase'

export interface DailyGoalProgress {
  activitiesToday: number
  target: number
  met: boolean
}

/** Today's activity count against a learner's daily_practice_target
 * (learners table, migration 0044) -- counts learner_points_ledger rows
 * (0036), which already logs one row per graded answer plus one for each
 * V2 practice-set completion bonus, so no separate "activity" concept is
 * needed. UTC day boundary, matching lib/streak/streak.ts. */
export async function fetchDailyGoalProgress(learnerId: string, target: number): Promise<DailyGoalProgress> {
  const startOfDayUtc = new Date()
  startOfDayUtc.setUTCHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('learner_points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .gte('created_at', startOfDayUtc.toISOString())

  const activitiesToday = count ?? 0
  return { activitiesToday, target, met: activitiesToday >= target }
}

export async function updateDailyTarget(learnerId: string, target: number): Promise<void> {
  const { error } = await supabase
    .from('learners')
    .update({ daily_practice_target: Math.max(1, Math.round(target)) })
    .eq('id', learnerId)
  if (error) throw error
}
