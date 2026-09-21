import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { PracticeBreadcrumbs } from '@/pages/practice/PracticeBreadcrumbs'
import {
  fetchPracticeSubjects,
  type PracticeSubjectSummary,
} from '@/lib/practice/queries'
import { localizedName } from '@/lib/i18n/localizedName'
import { useSeo } from '@/hooks/useSeo'
import { PageHero, Reveal, Section } from '@/components/marketing'
import { SkeletonList } from '@/components/ui'
import type { LanguageCode } from '@/types/curriculum'

/** `/practice/grade-5` -- pick a subject. */
export function PracticeGradePage() {
  const { t, i18n } = useTranslation()
  const { gradeSlug } = useParams<{ gradeSlug: string }>()
  const language = (i18n.language.startsWith('af') ? 'af' : 'en') as LanguageCode
  const [subjects, setSubjects] = useState<PracticeSubjectSummary[]>([])
  const [loading, setLoading] = useState(true)

  const gradeNumber = Number(gradeSlug?.replace('grade-', ''))
  const validGrade = Number.isInteger(gradeNumber) && gradeNumber >= 4 && gradeNumber <= 7

  useEffect(() => {
    if (!validGrade) return
    setLoading(true)
    void fetchPracticeSubjects(gradeNumber).then((rows) => {
      setSubjects(rows)
      setLoading(false)
    })
  }, [gradeNumber, validGrade])

  useSeo({
    title: t('practice.seo.gradeTitle', { grade: gradeNumber }),
    description: t('practice.seo.gradeDescription', { grade: gradeNumber }),
    path: `/practice/grade-${gradeNumber}`,
    noIndex: !validGrade,
  })

  if (!validGrade) return <Navigate to="/practice" replace />

  return (
    <MarketingShell surface="dark">
      <PageHero
        above={
          <PracticeBreadcrumbs
            items={[{ label: t('practice.gradeLabel', { grade: gradeNumber }) }]}
          />
        }
        eyebrow={t('practice.freeBadge')}
        title={t('practice.gradeHeading', { grade: gradeNumber })}
        lead={t('practice.gradeIntro')}
        aside={<PracticeLanguageToggle />}
      />

      <Section tone="light">
        {loading ? (
          <SkeletonList count={4} label={t('common.loading')} />
        ) : subjects.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-ink-500">
            {t('practice.noTestsForGrade')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {subjects.map((subject, i) => (
              <Reveal key={subject.subjectId} delay={i * 50}>
                <Link
                  to={`/practice/grade-${gradeNumber}/${subject.slug}`}
                  className="group flex h-full items-center justify-between gap-4 rounded-3xl border border-ink-200/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-volt-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300"
                >
                  <span className="min-w-0">
                    <span className="font-display block text-lg font-extrabold text-ink-900 break-words">
                      {localizedName(
                        { name: subject.name, name_af: subject.nameAf },
                        language,
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-ink-500">
                      {t('practice.testCount', { count: subject.testCount })} ·{' '}
                      {t('practice.questionCount', { count: subject.questionCount })}
                    </span>
                    {subject.languages.length > 1 && (
                      <span className="mt-2 inline-block rounded-full bg-volt-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-volt-700">
                        {t('practice.bothLanguages')}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    size={20}
                    aria-hidden
                    className="shrink-0 text-ink-300 transition group-hover:translate-x-1 group-hover:text-volt-600"
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </Section>
    </MarketingShell>
  )
}
