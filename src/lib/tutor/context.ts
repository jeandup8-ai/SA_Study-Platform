import { supabase } from '@/lib/supabase'
import { fetchVerifiedTerminology } from '@/lib/admin/terminology'
import { localizedName } from '@/lib/i18n/localizedName'

/**
 * Structured context for the AI tutor (spec section 26). Assembling this
 * correctly is what stops the tutor being a generic chatbot — every reply it
 * would generate is grounded in exactly what this learner is doing right now,
 * not a free-floating conversation.
 *
 * IMPLEMENTATION STATUS: this function is real and returns real data. What it
 * feeds into is NOT yet real — this codebase has no LLM integration (see
 * README "AI tutor actions" — "explain again"/"make it easier" are currently
 * content-driven, pulling a second pre-written lesson_content row, not an AI
 * call). This is the context object a future LLM-backed tutor call would
 * receive; building it now means adding that call later is "pass this object
 * to the model," not "figure out what data the model needs."
 */
export interface TutorContext {
  learnerId: string
  learnerDisplayName: string
  gradeNumber: number
  curriculumCode: string
  language: string
  subject: { id: string; name: string }
  topic: { id: string; name: string; masteryScore: number | null }
  lesson: { id: string; title: string } | null
  learningObjectives: string[]
  /** Wrong answers from this learner's last attempt on this topic, so the
   * tutor can address a specific misconception rather than repeat itself. */
  recentErrors: { prompt: string; theirAnswer: string | null; correctAnswer: string }[]
  /** Human-verified subject vocabulary in the learner's language only — never
   * an unreviewed machine translation (see terminology.verified). */
  terminology: { term: string; translation: string | null; definition: string | null }[]
}

export async function buildTutorContext(learnerId: string, topicId: string): Promise<TutorContext | null> {
  const { data: learner } = await supabase
    .from('learners')
    .select('display_name, preferred_language, grade_id, curriculum_id')
    .eq('id', learnerId)
    .maybeSingle()
  if (!learner) return null

  const [{ data: grade }, { data: curriculum }, { data: topic }, { data: mastery }] = await Promise.all([
    supabase.from('grades').select('grade_number').eq('id', learner.grade_id).maybeSingle(),
    supabase.from('curricula').select('code').eq('id', learner.curriculum_id).maybeSingle(),
    supabase.from('topics').select('id, name, name_af, subject_id').eq('id', topicId).maybeSingle(),
    supabase.from('mastery').select('mastery_score').eq('learner_id', learnerId).eq('topic_id', topicId).maybeSingle(),
  ])
  if (!topic) return null

  const [{ data: subject }, { data: objectives }, { data: lesson }] = await Promise.all([
    supabase.from('subjects').select('id, name, name_af').eq('id', topic.subject_id).maybeSingle(),
    supabase.from('learning_objectives').select('description').eq('topic_id', topicId),
    supabase.from('lessons').select('id, title').eq('topic_id', topicId).eq('language', learner.preferred_language).limit(1).maybeSingle(),
  ])

  const { data: lastAttempt } = await supabase
    .from('assessment_attempts')
    .select('id')
    .eq('learner_id', learnerId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let recentErrors: TutorContext['recentErrors'] = []
  if (lastAttempt) {
    const { data: wrongAnswers } = await supabase
      .from('assessment_answers')
      .select('question_id, answer_text, is_correct')
      .eq('attempt_id', lastAttempt.id)
      .eq('is_correct', false)

    if (wrongAnswers && wrongAnswers.length > 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select('id, prompt, correct_answer')
        .in('id', wrongAnswers.map((w) => w.question_id))
      const questionById = new Map((questions ?? []).map((q) => [q.id, q]))
      recentErrors = wrongAnswers
        .map((w) => {
          const q = questionById.get(w.question_id)
          if (!q) return null
          return { prompt: q.prompt, theirAnswer: w.answer_text, correctAnswer: q.correct_answer }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
    }
  }

  const terminologyRows = await fetchVerifiedTerminology(topic.subject_id, learner.preferred_language)

  return {
    learnerId,
    learnerDisplayName: learner.display_name,
    gradeNumber: grade?.grade_number ?? 0,
    curriculumCode: curriculum?.code ?? 'CAPS',
    language: learner.preferred_language,
    subject: subject
      ? { id: subject.id, name: localizedName(subject, learner.preferred_language) }
      : { id: topic.subject_id, name: 'Unknown' },
    topic: {
      id: topic.id,
      name: localizedName(topic, learner.preferred_language),
      masteryScore: mastery ? Number(mastery.mastery_score) : null,
    },
    lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
    learningObjectives: (objectives ?? []).map((o) => o.description),
    recentErrors,
    terminology: terminologyRows.map((row) => ({
      term: row.term,
      translation: row.translation,
      definition: row.definition,
    })),
  }
}
