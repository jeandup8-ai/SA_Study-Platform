import { useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { PracticeBreadcrumbs } from '@/pages/practice/PracticeBreadcrumbs'
import {
  fetchPracticeSubjects,
  type PracticeSubjectSummary,
} from '@/lib/practice/queries'
import { localizedName } from '@/lib/i18n/localizedName'
import { useSeo } from '@/hooks/useSeo'
import { Card } from '@/components/ui'
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
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <PracticeBreadcrumbs
          items={[{ label: t('practice.gradeLabel', { grade: gradeNumber }) }]}
        />

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">
              {t('practice.gradeHeading', { grade: gradeNumber })}
            </h1>
            <p className="mt-2 max-w-xl text-slate-600">{t('practice.gradeIntro')}</p>
          </div>
          <PracticeLanguageToggle />
        </div>

        {loading && <p className="mt-8 text-slate-400">{t('common.loading')}</p>}

        {!loading && subjects.length === 0 && (
          <Card className="mt-8 text-center text-slate-500">
            {t('practice.noTestsForGrade')}
          </Card>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => (
            <Link
              key={subject.subjectId}
              to={`/practice/grade-${gradeNumber}/${subject.slug}`}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <p className="text-lg font-bold text-slate-900">
                  {localizedName(
                    { name: subject.name, name_af: subject.nameAf },
                    language,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {t('practice.testCount', { count: subject.testCount })} ·{' '}
                  {t('practice.questionCount', { count: subject.questionCount })}
                </p>
                {subject.languages.length > 1 && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-brand-600">
                    {t('practice.bothLanguages')}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </MarketingShell>
  )
}
