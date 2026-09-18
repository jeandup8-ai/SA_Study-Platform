import { supabase } from '@/lib/supabase'

export interface MarketingSubject {
  slug: string
  name: string
  nameAf: string | null
  grades: number[]
  topicCount: number
}

/**
 * Subject coverage for the public site, read live from the curriculum.
 *
 * Hardcoding this list would let the marketing site drift from what the
 * product actually teaches -- claiming a subject or a grade we do not cover
 * is exactly the kind of inaccuracy that costs trust. Reading it means the
 * section grows on its own as curriculum is added.
 */
export async function fetchMarketingSubjects(): Promise<MarketingSubject[]> {
  const { data } = await supabase
    .from('topics')
    .select('id, subjects!inner ( slug, name, name_af ), grades!inner ( grade_number )')

  const bySlug = new Map<string, MarketingSubject>()

  for (const row of (data ?? []) as unknown as {
    subjects: { slug: string; name: string; name_af: string | null } | null
    grades: { grade_number: number } | null
  }[]) {
    const subject = row.subjects
    const grade = row.grades?.grade_number
    if (!subject || grade == null || grade < 4 || grade > 7) continue

    const existing = bySlug.get(subject.slug) ?? {
      slug: subject.slug,
      name: subject.name,
      nameAf: subject.name_af,
      grades: [] as number[],
      topicCount: 0,
    }
    existing.topicCount += 1
    if (!existing.grades.includes(grade)) existing.grades.push(grade)
    bySlug.set(subject.slug, existing)
  }

  return [...bySlug.values()]
    .map((subject) => ({ ...subject, grades: subject.grades.sort((a, b) => a - b) }))
    // Widest coverage first: the subjects a parent is most likely to want.
    .sort((a, b) => b.grades.length - a.grades.length || a.name.localeCompare(b.name))
}

/** "Grades 4-7" when contiguous, otherwise "Grade 7" / "Grades 4, 6". */
export function formatGradeRange(grades: number[]): { key: string; value: string } {
  if (grades.length === 0) return { key: 'm.subjects.gradesNone', value: '' }
  if (grades.length === 1) return { key: 'm.subjects.gradeOne', value: String(grades[0]) }
  const contiguous = grades.every((grade, index) => index === 0 || grade === grades[index - 1] + 1)
  if (contiguous) {
    return { key: 'm.subjects.gradeRange', value: `${grades[0]}–${grades[grades.length - 1]}` }
  }
  return { key: 'm.subjects.gradeList', value: grades.join(', ') }
}
