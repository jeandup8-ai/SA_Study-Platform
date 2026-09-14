import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TopicVideoRow = Database['public']['Tables']['topic_videos']['Row']

export interface TopicVideoReviewItem extends TopicVideoRow {
  topic_name: string | null
  subject_name: string | null
  grade_number: number | null
}

/** Suggested videos awaiting human review -- nothing here is ever surfaced
 * to a learner while `verified = false` (see fetchVerifiedTopicVideo). */
export async function fetchUnverifiedTopicVideos(): Promise<TopicVideoReviewItem[]> {
  const { data: videos } = await supabase
    .from('topic_videos')
    .select('*')
    .eq('verified', false)
    .order('created_at', { ascending: true })
  if (!videos || videos.length === 0) return []

  const topicIds = [...new Set(videos.map((v) => v.topic_id))]
  const { data: topics } = await supabase
    .from('topics')
    .select('id, name, subject_id, grade_id')
    .in('id', topicIds)

  const subjectIds = [...new Set((topics ?? []).map((t) => t.subject_id).filter((id): id is string => Boolean(id)))]
  const gradeIds = [...new Set((topics ?? []).map((t) => t.grade_id).filter((id): id is string => Boolean(id)))]

  const [{ data: subjects }, { data: grades }] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, name').in('id', subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    gradeIds.length > 0
      ? supabase.from('grades').select('id, grade_number').in('id', gradeIds)
      : Promise.resolve({ data: [] as { id: string; grade_number: number }[] }),
  ])

  const topicById = new Map((topics ?? []).map((t) => [t.id, t]))
  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))

  return videos.map((video) => {
    const topic = topicById.get(video.topic_id)
    return {
      ...video,
      topic_name: topic?.name ?? null,
      subject_name: topic?.subject_id ? (subjectById.get(topic.subject_id) ?? null) : null,
      grade_number: topic?.grade_id ? (gradeById.get(topic.grade_id) ?? null) : null,
    }
  })
}

export async function verifyTopicVideo(id: string, reviewerId: string) {
  const { error } = await supabase
    .from('topic_videos')
    .update({ verified: true, reviewer_id: reviewerId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function rejectTopicVideo(id: string) {
  const { error } = await supabase.from('topic_videos').delete().eq('id', id)
  if (error) throw error
}
