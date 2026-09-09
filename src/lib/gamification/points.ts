import { supabase } from '@/lib/supabase'

export const POINTS_PER_CORRECT_ANSWER = 10
export const POINTS_PER_ATTEMPT = 2 // participation credit even when wrong -- effort still counts
export const POINTS_PER_PRACTICE_SET_COMPLETED = 15 // V2 self-check practice has no per-question correctness signal

export type PointsReason = 'correct_answer' | 'attempt' | 'practice_completed'

/**
 * Awards points for a just-completed graded quiz/practice run (one row per
 * answer, so volume-based badges -- e.g. "100 correct answers" -- can be
 * computed later by counting ledger rows). Two round trips regardless of
 * question count: a batch insert into the log, then one atomic counter bump.
 */
export async function awardQuizPoints(
  learnerId: string,
  answers: { questionId: string; isCorrect: boolean }[],
): Promise<number> {
  if (answers.length === 0) return 0

  const rows = answers.map((a) => ({
    learner_id: learnerId,
    points: a.isCorrect ? POINTS_PER_CORRECT_ANSWER : POINTS_PER_ATTEMPT,
    reason: (a.isCorrect ? 'correct_answer' : 'attempt') as PointsReason,
    reference_id: a.questionId,
  }))
  const total = rows.reduce((sum, r) => sum + r.points, 0)

  await supabase.from('learner_points_ledger').insert(rows)
  await supabase.rpc('increment_learner_points', { p_learner_id: learnerId, p_amount: total })

  return total
}

/**
 * Flat completion bonus for V2 lessons' free-text self-check (PracticeSelfCheck),
 * which has no per-question correctness signal to grade against.
 */
export async function awardFlatPoints(learnerId: string, amount: number, reason: PointsReason, referenceId?: string): Promise<void> {
  if (amount <= 0) return
  await supabase.from('learner_points_ledger').insert({
    learner_id: learnerId,
    points: amount,
    reason,
    reference_id: referenceId ?? null,
  })
  await supabase.rpc('increment_learner_points', { p_learner_id: learnerId, p_amount: amount })
}
