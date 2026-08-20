import { supabase } from '@/lib/supabase'

/**
 * "What should I learn next?" (spec section 28). Priority order, each step only
 * consulted if the previous one found nothing:
 *   1. Curriculum sequence  — the next topic the learner hasn't started at all,
 *      in term/sort_order — following the syllabus is always the default path.
 *   2. Prerequisite weaknesses — a recent, reasonably-confident weakness signal
 *      (see mastery_weakness_signals) outranks a plain low score, because it
 *      names *why* the learner is stuck, not just that they are.
 *   3. Low mastery — the weakest topic they've already attempted.
 *   4. Upcoming assessment — an exam_periods row within the next 14 days pulls
 *      revision toward that subject even if another subject scores lower.
 *   5. Spaced revision — a topic they mastered but haven't touched in a while,
 *      oldest-practised first, so retention doesn't quietly decay.
 * All queries are flat (no PostgREST embeds), consistent with the rest of this
 * codebase's typing convention.
 */

export type RecommendationReason =
  | 'next_in_sequence'
  | 'prerequisite_weakness'
  | 'low_mastery'
  | 'upcoming_assessment'
  | 'spaced_revision'

export interface RecommendedTopic {
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
  reason: RecommendationReason
}

const LOW_MASTERY_THRESHOLD = 60
const SPACED_REVISION_DAYS = 14
const UPCOMING_ASSESSMENT_WINDOW_DAYS = 14

export async function recommendNextTopic(learnerId: string, gradeId: string): Promise<RecommendedTopic | null> {
  const { data: gradeSubjects } = await supabase.from('grade_subjects').select('subject_id').eq('grade_id', gradeId)
  const subjectIds = (gradeSubjects ?? []).map((r) => r.subject_id)
  if (subjectIds.length === 0) return null

  const { data: subjects } = await supabase.from('subjects').select('id, name').in('id', subjectIds)
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s]))

  const { data: topics } = await supabase
    .from('topics')
    .select('id, name, subject_id, term_id, sort_order')
    .eq('grade_id', gradeId)
    .in('subject_id', subjectIds)
  if (!topics || topics.length === 0) return null

  const { data: terms } = await supabase.from('terms').select('id, term_number').eq('grade_id', gradeId)
  const termNumberByTermId = new Map((terms ?? []).map((term) => [term.id, term.term_number]))

  const { data: masteryRows } = await supabase
    .from('mastery')
    .select('topic_id, mastery_score, last_practised_at')
    .eq('learner_id', learnerId)
  const masteryByTopicId = new Map((masteryRows ?? []).map((m) => [m.topic_id, m]))

  const sortedTopics = [...topics].sort((a, b) => {
    const termA = a.term_id ? (termNumberByTermId.get(a.term_id) ?? 99) : 99
    const termB = b.term_id ? (termNumberByTermId.get(b.term_id) ?? 99) : 99
    if (termA !== termB) return termA - termB
    return a.sort_order - b.sort_order
  })

  const nextInSequence = sortedTopics.find((topic) => !masteryByTopicId.has(topic.id))
  if (nextInSequence) return toRecommendation(nextInSequence, subjectById, 'next_in_sequence')

  const { data: weaknessSignals } = await supabase
    .from('mastery_weakness_signals')
    .select('topic_id, confidence, created_at')
    .eq('learner_id', learnerId)
    .in(
      'topic_id',
      topics.map((t) => t.id),
    )
    .gte('confidence', 0.3)
    .order('created_at', { ascending: false })
    .limit(20)
  if (weaknessSignals && weaknessSignals.length > 0) {
    const weakTopic = topics.find((t) => t.id === weaknessSignals[0].topic_id)
    if (weakTopic) return toRecommendation(weakTopic, subjectById, 'prerequisite_weakness')
  }

  const lowestMastery = sortedTopics
    .filter((topic) => {
      const mastery = masteryByTopicId.get(topic.id)
      return mastery !== undefined && Number(mastery.mastery_score) < LOW_MASTERY_THRESHOLD
    })
    .sort((a, b) => Number(masteryByTopicId.get(a.id)!.mastery_score) - Number(masteryByTopicId.get(b.id)!.mastery_score))[0]
  if (lowestMastery) return toRecommendation(lowestMastery, subjectById, 'low_mastery')

  const today = new Date()
  const windowEnd = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + UPCOMING_ASSESSMENT_WINDOW_DAYS)
  const { data: upcomingExams } = await supabase
    .from('exam_periods')
    .select('subject_id, starts_on')
    .eq('grade_id', gradeId)
    .gte('starts_on', today.toISOString().slice(0, 10))
    .lte('starts_on', windowEnd.toISOString().slice(0, 10))
  if (upcomingExams && upcomingExams.length > 0) {
    const examSubjectIds = new Set(upcomingExams.map((e) => e.subject_id))
    const candidate = sortedTopics
      .filter((topic) => examSubjectIds.has(topic.subject_id))
      .sort(
        (a, b) =>
          Number(masteryByTopicId.get(a.id)?.mastery_score ?? 0) - Number(masteryByTopicId.get(b.id)?.mastery_score ?? 0),
      )[0]
    if (candidate) return toRecommendation(candidate, subjectById, 'upcoming_assessment')
  }

  const staleCutoff = new Date(today)
  staleCutoff.setDate(staleCutoff.getDate() - SPACED_REVISION_DAYS)
  const staleTopic = sortedTopics
    .filter((topic) => {
      const mastery = masteryByTopicId.get(topic.id)
      return !!mastery?.last_practised_at && new Date(mastery.last_practised_at) < staleCutoff
    })
    .sort(
      (a, b) =>
        new Date(masteryByTopicId.get(a.id)!.last_practised_at!).getTime() -
        new Date(masteryByTopicId.get(b.id)!.last_practised_at!).getTime(),
    )[0]
  if (staleTopic) return toRecommendation(staleTopic, subjectById, 'spaced_revision')

  return null
}

function toRecommendation(
  topic: { id: string; name: string; subject_id: string },
  subjectById: Map<string, { id: string; name: string }>,
  reason: RecommendationReason,
): RecommendedTopic | null {
  const subject = subjectById.get(topic.subject_id)
  if (!subject) return null
  return { topicId: topic.id, topicName: topic.name, subjectId: subject.id, subjectName: subject.name, reason }
}
