import { supabase } from '@/lib/supabase'
import type { Curriculum, Grade, Subject, Topic, Lesson, LessonContent, Media, LanguageCode } from '@/types/curriculum'

export async function fetchActiveCurriculum(): Promise<Curriculum | null> {
  const { data } = await supabase.from('curricula').select('*').eq('code', 'CAPS').maybeSingle()
  return data
}

export async function fetchLaunchedGrades(curriculumId: string): Promise<Grade[]> {
  const { data } = await supabase
    .from('grades')
    .select('*')
    .eq('curriculum_id', curriculumId)
    .eq('is_launched', true)
    .order('grade_number')
  return data ?? []
}

export async function fetchSubjectsForGrade(gradeId: string): Promise<Subject[]> {
  const { data } = await supabase
    .from('grade_subjects')
    .select('sort_order, subjects(*)')
    .eq('grade_id', gradeId)
    .order('sort_order')
  return (data ?? []).map((row) => row.subjects).filter((s): s is Subject => Boolean(s))
}

export async function fetchTopicsForSubjectAndGrade(subjectId: string, gradeId: string): Promise<Topic[]> {
  const { data } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('grade_id', gradeId)
    .order('sort_order')
  return data ?? []
}

export async function fetchLessonsForTopic(topicId: string, language: LanguageCode): Promise<Lesson[]> {
  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('topic_id', topicId)
    .eq('language', language)
    .order('sort_order')
  if (data && data.length > 0) return data
  // Fall back to English if the learner's language isn't available for this lesson yet.
  const fallback = await supabase
    .from('lessons')
    .select('*')
    .eq('topic_id', topicId)
    .eq('language', 'en')
    .order('sort_order')
  return fallback.data ?? []
}

export async function fetchLesson(lessonId: string): Promise<Lesson | null> {
  const { data } = await supabase.from('lessons').select('*').eq('id', lessonId).maybeSingle()
  return data
}

export async function fetchLessonContent(lessonId: string): Promise<LessonContent[]> {
  const { data } = await supabase
    .from('lesson_content')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('sort_order')
  return data ?? []
}

export async function fetchLessonMedia(lessonId: string): Promise<Media[]> {
  const { data } = await supabase
    .from('media')
    .select('*')
    .eq('lesson_id', lessonId)
    .eq('approval_status', 'approved')
  return data ?? []
}
