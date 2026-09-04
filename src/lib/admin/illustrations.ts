import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Media = Database['public']['Tables']['media']['Row']

export interface PendingIllustration extends Media {
  topic_name: string
  subject_name: string
  grade_number: number
}

/** Image media rows awaiting a human's approve/reject before any learner can
 * ever see them -- media_read RLS already enforces this server-side; this is
 * just the admin queue that surfaces what's waiting. */
export async function fetchPendingIllustrations(): Promise<PendingIllustration[]> {
  const { data: rows } = await supabase
    .from('media')
    .select('*')
    .eq('media_type', 'image')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
  if (!rows || rows.length === 0) return []

  const topicIds = [...new Set(rows.map((r) => r.topic_id).filter((id): id is string => Boolean(id)))]
  const { data: topics } = await supabase.from('topics').select('id, name, subject_id, grade_id').in('id', topicIds)

  const subjectIds = [...new Set((topics ?? []).map((t) => t.subject_id))]
  const gradeIds = [...new Set((topics ?? []).map((t) => t.grade_id))]
  const [{ data: subjects }, { data: grades }] = await Promise.all([
    supabase.from('subjects').select('id, name').in('id', subjectIds),
    supabase.from('grades').select('id, grade_number').in('id', gradeIds),
  ])

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))
  const topicById = new Map((topics ?? []).map((t) => [t.id, t]))

  return rows.map((row) => {
    const topic = row.topic_id ? topicById.get(row.topic_id) : undefined
    return {
      ...row,
      topic_name: topic?.name ?? 'Unknown topic',
      subject_name: topic ? (subjectById.get(topic.subject_id) ?? 'Unknown subject') : 'Unknown subject',
      grade_number: topic ? (gradeById.get(topic.grade_id) ?? 0) : 0,
    }
  })
}

export async function approveIllustration(mediaId: string) {
  const { error } = await supabase.from('media').update({ approval_status: 'approved' }).eq('id', mediaId)
  if (error) throw error
}

export async function rejectIllustration(mediaId: string) {
  const { error } = await supabase.from('media').update({ approval_status: 'rejected' }).eq('id', mediaId)
  if (error) throw error
}

export interface TopicIllustrationStatus {
  id: string
  name: string
  subject_name: string
  grade_number: number
  status: 'none' | 'pending' | 'approved' | 'rejected'
}

/** Every real (non-demo) topic, with whatever illustration status it
 * currently has -- 'none' means no image has ever been generated for it.
 * Ordered so 'none' topics surface first, since those are the actionable
 * ones for an admin working through the list. */
export async function fetchTopicIllustrationStatuses(): Promise<TopicIllustrationStatus[]> {
  const { data: topics } = await supabase
    .from('topics')
    .select('id, name, subject_id, grade_id')
    .eq('is_demo_content', false)
    .order('name', { ascending: true })
  if (!topics || topics.length === 0) return []

  const subjectIds = [...new Set(topics.map((t) => t.subject_id))]
  const gradeIds = [...new Set(topics.map((t) => t.grade_id))]
  const topicIds = topics.map((t) => t.id)

  const [{ data: subjects }, { data: grades }, { data: mediaRows }] = await Promise.all([
    supabase.from('subjects').select('id, name').in('id', subjectIds),
    supabase.from('grades').select('id, grade_number').in('id', gradeIds),
    supabase
      .from('media')
      .select('topic_id, approval_status, created_at')
      .eq('media_type', 'image')
      .in('topic_id', topicIds)
      .order('created_at', { ascending: false }),
  ])

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))
  // First row per topic (already sorted newest-first) is that topic's current status.
  const statusByTopic = new Map<string, TopicIllustrationStatus['status']>()
  for (const row of mediaRows ?? []) {
    if (row.topic_id && !statusByTopic.has(row.topic_id)) {
      statusByTopic.set(row.topic_id, row.approval_status)
    }
  }

  return topics
    .map((t) => ({
      id: t.id,
      name: t.name,
      subject_name: subjectById.get(t.subject_id) ?? 'Unknown subject',
      grade_number: gradeById.get(t.grade_id) ?? 0,
      status: statusByTopic.get(t.id) ?? ('none' as const),
    }))
    .sort((a, b) => (a.status === 'none' ? -1 : b.status === 'none' ? 1 : 0))
}

export interface GenerateIllustrationResult {
  ok: boolean
  error?: string
}

export async function generateTopicIllustration(topicId: string): Promise<GenerateIllustrationResult> {
  const { data, error } = await supabase.functions.invoke('generate-topic-illustration', { body: { topicId } })
  if (error) {
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    const respBody = await context?.json?.().catch(() => null)
    return { ok: false, error: respBody?.error ?? 'unknown' }
  }
  if (!data?.media) return { ok: false, error: 'unknown' }
  return { ok: true }
}
