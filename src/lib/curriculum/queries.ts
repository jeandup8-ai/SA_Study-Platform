import { supabase } from '@/lib/supabase'
import { localizedName } from '@/lib/i18n/localizedName'
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

export async function fetchSubjectsForGrade(gradeId: string, language: LanguageCode = 'en'): Promise<Subject[]> {
  const { data } = await supabase
    .from('grade_subjects')
    .select('sort_order, subjects(*)')
    .eq('grade_id', gradeId)
    .order('sort_order')
  return (data ?? [])
    .map((row) => row.subjects)
    .filter((s): s is Subject => Boolean(s))
    .map((s) => ({ ...s, name: localizedName(s, language) }))
}

export async function fetchTopicsForSubjectAndGrade(
  subjectId: string,
  gradeId: string,
  language: LanguageCode = 'en',
): Promise<Topic[]> {
  const { data } = await supabase
    .from('topics')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('grade_id', gradeId)
    .order('sort_order')
  return (data ?? []).map((t) => ({ ...t, name: localizedName(t, language) }))
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
  if (fallback.data && fallback.data.length > 0) return fallback.data
  // A language-instruction subject (e.g. Afrikaans First Additional Language) only
  // ever has lessons tagged in the language being taught, which is neither the
  // learner's own preferred_language nor necessarily 'en' -- fall back to whatever
  // this topic actually has rather than showing an empty lesson list.
  const anyLanguage = await supabase.from('lessons').select('*').eq('topic_id', topicId).order('sort_order')
  return anyLanguage.data ?? []
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

/** The most recent approved AI illustration for a topic, if any -- used by
 * both V2 and legacy lessons since V2 lessons have no `media` rows of their
 * own (see supabase/functions/generate-topic-illustration). */
export async function fetchTopicIllustration(topicId: string): Promise<string | null> {
  const { data } = await supabase
    .from('media')
    .select('url')
    .eq('topic_id', topicId)
    .eq('media_type', 'image')
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.url ?? null
}
