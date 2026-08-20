import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TerminologyRow = Database['public']['Tables']['terminology']['Row']
type LanguageCode = Database['public']['Enums']['language_code']

export interface TerminologyReviewItem extends TerminologyRow {
  subject_name: string | null
  grade_number: number | null
  source_title: string | null
}

/** Unverified terms — a term/language pair a human has not yet confirmed
 * against the source document (spec section 6/23: machine-translated subject
 * vocabulary must never reach a learner unreviewed). */
export async function fetchUnverifiedTerminology(): Promise<TerminologyReviewItem[]> {
  const { data: terms } = await supabase
    .from('terminology')
    .select('*')
    .eq('verified', false)
    .order('created_at', { ascending: true })
  if (!terms || terms.length === 0) return []

  const subjectIds = [...new Set(terms.map((t) => t.subject_id).filter((id): id is string => Boolean(id)))]
  const gradeIds = [...new Set(terms.map((t) => t.grade_id).filter((id): id is string => Boolean(id)))]
  const sourceIds = [...new Set(terms.map((t) => t.source_id).filter((id): id is string => Boolean(id)))]

  const [{ data: subjects }, { data: grades }, { data: sources }] = await Promise.all([
    subjectIds.length > 0
      ? supabase.from('subjects').select('id, name').in('id', subjectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    gradeIds.length > 0
      ? supabase.from('grades').select('id, grade_number').in('id', gradeIds)
      : Promise.resolve({ data: [] as { id: string; grade_number: number }[] }),
    sourceIds.length > 0
      ? supabase.from('curriculum_sources').select('id, title').in('id', sourceIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ])

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s.title]))

  return terms.map((term) => ({
    ...term,
    subject_name: term.subject_id ? (subjectById.get(term.subject_id) ?? null) : null,
    grade_number: term.grade_id ? (gradeById.get(term.grade_id) ?? null) : null,
    source_title: term.source_id ? (sourceById.get(term.source_id) ?? null) : null,
  }))
}

export async function verifyTerminology(id: string, reviewerId: string) {
  const { error } = await supabase
    .from('terminology')
    .update({ verified: true, reviewer_id: reviewerId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTerminology(id: string) {
  const { error } = await supabase.from('terminology').delete().eq('id', id)
  if (error) throw error
}

/** Verified terms for a subject/language — the only ones a learner-facing
 * glossary or tutor context is allowed to surface. */
export async function fetchVerifiedTerminology(subjectId: string, language: LanguageCode): Promise<TerminologyRow[]> {
  const { data } = await supabase
    .from('terminology')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('language', language)
    .eq('verified', true)
    .order('term', { ascending: true })
  return data ?? []
}
