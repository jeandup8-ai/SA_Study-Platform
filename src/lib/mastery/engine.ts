import { supabase } from '@/lib/supabase'
import type { QuestionAnswerRecord } from '@/components/lesson/QuestionRunner'

/**
 * Mastery is an exponential moving average over quiz/practice results, weighted
 * towards recent performance (0.6 new / 0.4 prior) so a learner who improves sees it
 * reflected quickly, while a single lucky guess doesn't spike the score. This is a
 * simple, explainable starting point for the "mastery engine" — the spec's more
 * advanced goal (inferring *why* a learner is struggling, e.g. place-value underlying
 * a multiplication weakness) is represented structurally by `mastery_weakness_signals`
 * but the signal here is a coarse heuristic (score < 60 => flag "needs_practice"), not
 * genuine error-pattern analysis. That requires either hand-authored per-question
 * `learning_objective` tagging at scale or an LLM-backed classifier — both future work.
 */
export async function recordQuizResult(params: {
  learnerId: string
  topicId: string
  lessonId?: string
  correctCount: number
  total: number
  answers: QuestionAnswerRecord[]
  assessmentId?: string
  sessionStartedAt?: Date
}): Promise<{ newMasteryScore: number }> {
  const { learnerId, topicId, lessonId = null, correctCount, total, answers, assessmentId, sessionStartedAt } = params
  const scorePercent = total > 0 ? (correctCount / total) * 100 : 0

  const { data: existing } = await supabase
    .from('mastery')
    .select('*')
    .eq('learner_id', learnerId)
    .eq('topic_id', topicId)
    .maybeSingle()

  const newScore = existing ? existing.mastery_score * 0.4 + scorePercent * 0.6 : scorePercent

  await supabase.from('mastery').upsert(
    {
      learner_id: learnerId,
      topic_id: topicId,
      mastery_score: newScore,
      attempts_count: (existing?.attempts_count ?? 0) + 1,
      last_practised_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'learner_id,topic_id' },
  )

  if (scorePercent < 60) {
    await supabase.from('mastery_weakness_signals').insert({
      learner_id: learnerId,
      topic_id: topicId,
      signal_code: 'needs_practice',
      description: `Scored ${Math.round(scorePercent)}% on a recent quiz for this topic.`,
      confidence: 0.4,
    })
  }

  if (assessmentId) {
    const { data: attempt } = await supabase
      .from('assessment_attempts')
      .insert({
        learner_id: learnerId,
        assessment_id: assessmentId,
        completed_at: new Date().toISOString(),
        score: scorePercent,
        total_questions: total,
      })
      .select('id')
      .single()

    if (attempt) {
      await supabase.from('assessment_answers').insert(
        answers.map((a) => ({
          attempt_id: attempt.id,
          question_id: a.questionId,
          selected_option_id: a.selectedOptionId,
          is_correct: a.isCorrect,
        })),
      )
    }
  }

  const startedAt = sessionStartedAt ?? new Date()
  const endedAt = new Date()
  await supabase.from('study_sessions').insert({
    learner_id: learnerId,
    topic_id: topicId,
    lesson_id: lessonId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_seconds: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)),
  })

  return { newMasteryScore: newScore }
}

/**
 * Mock/exam-style tests span many topics in one sitting. Answers are grouped by
 * each question's topic so every topic's mastery moves independently, the way a real
 * exam's marks would be attributed per curriculum area.
 */
export async function recordMockTestResult(params: {
  learnerId: string
  subjectId: string
  questionsWithTopic: { questionId: string; topicId: string }[]
  answers: QuestionAnswerRecord[]
  sessionStartedAt: Date
}): Promise<void> {
  const { learnerId, questionsWithTopic, answers, sessionStartedAt } = params
  const topicIdByQuestion = new Map(questionsWithTopic.map((q) => [q.questionId, q.topicId]))

  const byTopic = new Map<string, QuestionAnswerRecord[]>()
  for (const answer of answers) {
    const topicId = topicIdByQuestion.get(answer.questionId)
    if (!topicId) continue
    const list = byTopic.get(topicId) ?? []
    list.push(answer)
    byTopic.set(topicId, list)
  }

  for (const [topicId, topicAnswers] of byTopic) {
    const correctCount = topicAnswers.filter((a) => a.isCorrect).length
    await recordQuizResult({
      learnerId,
      topicId,
      // no single lesson context for a mock test — study_sessions.lesson_id is nullable
      correctCount,
      total: topicAnswers.length,
      answers: topicAnswers,
      sessionStartedAt,
    })
  }
}
