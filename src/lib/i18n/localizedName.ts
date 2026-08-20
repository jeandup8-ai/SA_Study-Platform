import type { LanguageCode } from '@/types/curriculum'

/**
 * Structural/navigational labels (grade, term, subject, topic names) carry a
 * `name` (English, canonical) plus an optional `name_af` on the row itself —
 * a separate mechanism from the per-language lesson/lesson_content/questions
 * rows, since these are short platform labels rather than authored content.
 * Falls back to `name` whenever a translation doesn't exist yet, so a missing
 * `name_af` never surfaces as a blank label.
 */
export function localizedName(row: { name: string; name_af: string | null }, language: LanguageCode): string {
  if (language === 'af' && row.name_af) return row.name_af
  return row.name
}
