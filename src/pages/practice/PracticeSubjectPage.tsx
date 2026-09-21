import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { PracticeBreadcrumbs } from '@/pages/practice/PracticeBreadcrumbs'
import {
  fetchPracticeSubjects,
  fetchPracticeTests,
  practiceTestTitle,
  practiceTestSummary,
  type PracticeSubjectSummary,
  type PracticeTestSummary,
} from '@/lib/practice/queries'
import { localizedName } from '@/lib/i18n/localizedName'
import { useSeo } from '@/hooks/useSeo'
import { PageHero, Reveal, Section } from '@/components/marketing'
import { SkeletonList } from '@/components/ui'
import type { LanguageCode } from '@/types/curriculum'

/** `/practice/grade-5/mathematics` -- every free test in one subject. */
export function PracticeSubjectPage() {
  const { t, i18n } = useTranslation()
  const { gradeSlug, subjectSlug } = useParams<{
    gradeSlug: string
    subjectSlug: string
  }>()
  const language = (i18n.language.startsWith('af') ? 'af' : 'en') as LanguageCode
  const [tests, setTests] = useState<PracticeTestSummary[]>([])
  const [subject, setSubject] = useState<PracticeSubjectSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const gradeNumber = Number(gradeSlug?.replace('grade-', ''))
  const validGrade = Number.isInteger(gradeNumber) && gradeNumber >= 4 && gradeNumber <= 7

  useEffect(() => {
    if (!validGrade || !subjectSlug) return
    setLoading(true)
    void Promise.all([
      fetchPracticeTests(gradeNumber, subjectSlug),
      fetchPracticeSubjects(gradeNumber),
    ]).then(([testRows, subjectRows]) => {
      setTests(testRows)
      setSubject(subjectRows.find((s) => s.slug === subjectSlug) ?? null)
      setLoading(false)
    })
  }, [gradeNumber, validGrade, subjectSlug])

  const subjectName = subject
    ? localizedName({ name: subject.name, name_af: subject.nameAf }, language)
    : (subjectSlug ?? '')

  useSeo({
    title: t('practice.seo.subjectTitle', { grade: gradeNumber, subject: subjectName }),
    description: t('practice.seo.subjectDescription', {
      grade: gradeNumber,
      subject: subjectName,
    }),
    path: `/practice/grade-${gradeNumber}/${subjectSlug}`,
    noIndex: !loading && tests.length === 0,
  })

  if (!validGrade || !subjectSlug) return <Navigate to="/practice" replace />

  return (
    <MarketingShell surface="dark">
      <PageHero
        above={
          <PracticeBreadcrumbs
            items={[
              {
                label: t('practice.gradeLabel', { grade: gradeNumber }),
                to: `/practice/grade-${gradeNumber}`,
              },
              { label: subjectName },
            ]}
          />
        }
        eyebrow={t('practice.freeBadge')}
        title={t('practice.subjectHeading', { grade: gradeNumber, subject: subjectName })}
        lead={t('practice.subjectIntro')}
        aside={<PracticeLanguageToggle />}
      />

      <Section tone="light">
        {loading ? (
          <SkeletonList count={5} label={t('common.loading')} />
        ) : tests.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-ink-500">
            {t('practice.noTestsForSubject')}
          </p>
        ) : (
          <div className="space-y-3">
            {tests.map((test, i) => {
              const summary = practiceTestSummary(test, language)
              return (
                <Reveal key={test.id} delay={Math.min(i, 10) * 40}>
                  <Link
                    to={`/practice/grade-${gradeNumber}/${subjectSlug}/${test.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-3xl border border-ink-200/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-volt-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-display text-lg font-extrabold text-ink-900 break-words">
                          {practiceTestTitle(test, language)}
                        </span>
                        <span className="text-xs font-semibold text-ink-400">
                          {t('practice.questionCount', { count: test.questionCount })}
                          {test.languages.length > 1
                            ? ` · ${t('practice.bothLanguages')}`
                            : ''}
                        </span>
                      </span>
                      {summary && (
                        <span className="mt-1.5 block text-sm text-ink-500">
                          {summary}
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
              )
            })}
          </div>
        )}
      </Section>
    </MarketingShell>
  )
}
