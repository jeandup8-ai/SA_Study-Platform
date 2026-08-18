import { supabase } from '@/lib/supabase'

export interface ContinueLearningItem {
  lessonId: string
  lessonTitle: string
  topicId: string
  topicName: string
  subjectId: string
  subjectName: string
}

// Nested PostgREST embeds are avoided here in favour of a few flat, plainly-typed
// queries — simpler to keep correctly typed against the generated Database types
// than relying on the query-builder's string-parsed embed inference.
export async function fetchContinueLearning(learnerId: string): Promise<ContinueLearningItem | null> {
  const { data: progress } = await supabase
    .from('learner_progress')
    .select('lesson_id')
    .eq('learner_id', learnerId)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!progress) return null

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, topic_id')
    .eq('id', progress.lesson_id)
    .maybeSingle()
  if (!lesson) return null

  const { data: topic } = await supabase
    .from('topics')
    .select('id, name, subject_id')
    .eq('id', lesson.topic_id)
    .maybeSingle()
  if (!topic) return null

  const { data: subject } = await supabase
    .from('subjects')
    .select('id, name')
    .eq('id', topic.subject_id)
    .maybeSingle()
  if (!subject) return null

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    topicId: topic.id,
    topicName: topic.name,
    subjectId: subject.id,
    subjectName: subject.name,
  }
}

export interface SubjectMasterySummary {
  subjectId: string
  subjectName: string
  colorKey: string | null
  averageMastery: number
}

export async function fetchSubjectMasterySummary(
  learnerId: string,
  gradeId: string,
): Promise<SubjectMasterySummary[]> {
  const { data: gradeSubjects } = await supabase
    .from('grade_subjects')
    .select('subject_id, sort_order')
    .eq('grade_id', gradeId)
    .order('sort_order')
  const subjectIds = (gradeSubjects ?? []).map((r) => r.subject_id)
  if (subjectIds.length === 0) return []

  const { data: subjects } = await supabase.from('subjects').select('id, name, color_key').in('id', subjectIds)

  const { data: topics } = await supabase.from('topics').select('id, subject_id').in('subject_id', subjectIds)
  const topicToSubject = new Map((topics ?? []).map((t) => [t.id, t.subject_id]))

  const { data: masteryRows } = await supabase
    .from('mastery')
    .select('mastery_score, topic_id')
    .eq('learner_id', learnerId)

  const bySubject = new Map<string, number[]>()
  for (const row of masteryRows ?? []) {
    const subjectId = topicToSubject.get(row.topic_id)
    if (!subjectId) continue
    const list = bySubject.get(subjectId) ?? []
    list.push(Number(row.mastery_score))
    bySubject.set(subjectId, list)
  }

  return (subjects ?? [])
    .sort((a, b) => subjectIds.indexOf(a.id) - subjectIds.indexOf(b.id))
    .map((s) => {
      const scores = bySubject.get(s.id) ?? []
      const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      return { subjectId: s.id, subjectName: s.name, colorKey: s.color_key, averageMastery: average }
    })
}
