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

  await updateSkillMastery({ learnerId, topicId, answers })

  return { newMasteryScore: newScore }
}

/**
 * Skill-level mastery (spec section 27) — and, filtered to the 'application'
 * skill, the IEB application score (section 17) — computed from which skills
 * the just-answered questions were tagged with (question_skills), using the
 * same EMA approach as topic mastery. A question can carry multiple skill
 * tags; each contributes independently, weighted by `question_skills.weight`.
 */
async function updateSkillMastery(params: {
  learnerId: string
  topicId: string
  answers: QuestionAnswerRecord[]
}): Promise<void> {
  const { learnerId, topicId, answers } = params
  if (answers.length === 0) return

  const [{ data: topic }, { data: questionSkillRows }] = await Promise.all([
    supabase.from('topics').select('subject_id').eq('id', topicId).maybeSingle(),
    supabase
      .from('question_skills')
      .select('question_id, skill_id, weight')
      .in(
        'question_id',
        answers.map((a) => a.questionId),
      ),
  ])
  if (!topic || !questionSkillRows || questionSkillRows.length === 0) return

  const isCorrectByQuestion = new Map(answers.map((a) => [a.questionId, a.isCorrect]))

  const bySkill = new Map<string, { correctWeight: number; totalWeight: number }>()
  for (const row of questionSkillRows) {
    const isCorrect = isCorrectByQuestion.get(row.question_id)
    if (isCorrect === undefined) continue
    const bucket = bySkill.get(row.skill_id) ?? { correctWeight: 0, totalWeight: 0 }
    bucket.totalWeight += row.weight
    if (isCorrect) bucket.correctWeight += row.weight
    bySkill.set(row.skill_id, bucket)
  }

  for (const [skillId, { correctWeight, totalWeight }] of bySkill) {
    if (totalWeight === 0) continue
    const scorePercent = (correctWeight / totalWeight) * 100

    const { data: existing } = await supabase
      .from('learner_skill_mastery')
      .select('mastery_score, attempts_count')
      .eq('learner_id', learnerId)
      .eq('skill_id', skillId)
      .eq('topic_id', topicId)
      .eq('subject_id', topic.subject_id)
      .maybeSingle()

    const newScore = existing ? existing.mastery_score * 0.4 + scorePercent * 0.6 : scorePercent

    await supabase.from('learner_skill_mastery').upsert(
      {
        learner_id: learnerId,
        skill_id: skillId,
        topic_id: topicId,
        subject_id: topic.subject_id,
        mastery_score: newScore,
        attempts_count: (existing?.attempts_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'learner_id,skill_id,topic_id,subject_id' },
    )
  }
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
