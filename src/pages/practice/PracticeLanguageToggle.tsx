import { LanguageToggle } from '@/components/layout/LanguageToggle'

/**
 * Kept as a named re-export so the four /practice pages do not all have to
 * change, and because the name still says something true about where it
 * sits. The behaviour now lives in one place: /practice is public, so there
 * is normally no active learner and the shared toggle switches the
 * interface only -- but a signed-in parent browsing /practice gets the same
 * write-through as everywhere else, which is the consistent answer.
 */
export function PracticeLanguageToggle({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return <LanguageToggle tone={tone} />
}
