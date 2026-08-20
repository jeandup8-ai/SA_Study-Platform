import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type CurriculumSource = Database['public']['Tables']['curriculum_sources']['Row']
type Topic = Database['public']['Tables']['topics']['Row']
type SourceStatus = Database['public']['Enums']['source_verification_status']
type ContentStatus = Database['public']['Enums']['content_workflow_status']

export async function fetchCurriculumSources(): Promise<CurriculumSource[]> {
  const { data } = await supabase.from('curriculum_sources').select('*').order('created_at', { ascending: false })
  return data ?? []
}

export async function updateSourceStatus(id: string, status: SourceStatus) {
  const { error } = await supabase
    .from('curriculum_sources')
    .update({ status, updated_at: new Date().toISOString(), ...(status === 'VERIFIED' ? { last_verified: new Date().toISOString() } : {}) })
    .eq('id', id)
  if (error) throw error
}

export interface ReviewQueueItem extends Topic {
  subject_name: string
  grade_number: number
  source_title: string | null
}

/** Topics awaiting human review — the core of the admin review queue (spec
 * section 35): shows exactly what a reviewer needs to check the extracted
 * record against the original source document. */
export async function fetchReviewQueue(): Promise<ReviewQueueItem[]> {
  const { data: topics } = await supabase
    .from('topics')
    .select('*')
    .eq('content_workflow_status', 'REVIEW_REQUIRED')
    .order('created_at', { ascending: true })

  if (!topics || topics.length === 0) return []

  const subjectIds = [...new Set(topics.map((t) => t.subject_id))]
  const gradeIds = [...new Set(topics.map((t) => t.grade_id))]
  const sourceIds = [...new Set(topics.map((t) => t.source_id).filter((id): id is string => Boolean(id)))]

  const [{ data: subjects }, { data: grades }, { data: sources }] = await Promise.all([
    supabase.from('subjects').select('id, name').in('id', subjectIds),
    supabase.from('grades').select('id, grade_number').in('id', gradeIds),
    sourceIds.length > 0
      ? supabase.from('curriculum_sources').select('id, title').in('id', sourceIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s.title]))

  return topics.map((t) => ({
    ...t,
    subject_name: subjectById.get(t.subject_id) ?? 'Unknown subject',
    grade_number: gradeById.get(t.grade_id) ?? 0,
    source_title: t.source_id ? (sourceById.get(t.source_id) ?? null) : null,
  }))
}

export async function updateTopicWorkflowStatus(id: string, status: ContentStatus) {
  const { error } = await supabase.from('topics').update({ content_workflow_status: status }).eq('id', id)
  if (error) throw error
}
