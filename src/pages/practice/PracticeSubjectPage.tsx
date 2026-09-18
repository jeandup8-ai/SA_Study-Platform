import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { Card } from '@/components/ui'
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
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PracticeBreadcrumbs
          items={[
            {
              label: t('practice.gradeLabel', { grade: gradeNumber }),
              to: `/practice/grade-${gradeNumber}`,
            },
            { label: subjectName },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
              {t('practice.subjectHeading', { grade: gradeNumber, subject: subjectName })}
            </h1>
            <p className="mt-2 max-w-xl text-slate-600">{t('practice.subjectIntro')}</p>
          </div>
          <PracticeLanguageToggle />
        </div>

        {loading && <p className="mt-8 text-slate-400">{t('common.loading')}</p>}

        {!loading && tests.length === 0 && (
          <Card className="mt-8 text-center text-slate-500">
            {t('practice.noTestsForSubject')}
          </Card>
        )}

        <div className="mt-8 space-y-3">
          {tests.map((test) => {
            const summary = practiceTestSummary(test, language)
            return (
              <Link
                key={test.id}
                to={`/practice/grade-${gradeNumber}/${subjectSlug}/${test.slug}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-slate-900">
                      {practiceTestTitle(test, language)}
                    </p>
                    <p className="text-xs font-semibold text-slate-400">
                      {t('practice.questionCount', { count: test.questionCount })}
                      {test.languages.length > 1
                        ? ` · ${t('practice.bothLanguages')}`
                        : ''}
                    </p>
                  </div>
                  {summary && <p className="mt-1 text-sm text-slate-500">{summary}</p>}
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </MarketingShell>
  )
}
