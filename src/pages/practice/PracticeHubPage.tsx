import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Languages, BookOpenCheck } from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { fetchPracticeGradeCounts } from '@/lib/practice/queries'
import { useSeo } from '@/hooks/useSeo'
import { Card } from '@/components/ui'

const GRADES = [4, 5, 6, 7]

/**
 * `/practice` -- the free, ungated entry point. Nothing here is behind a login
 * or a paywall: it exists to be found in search by a parent typing "grade 5
 * maths test" the week before exams, and to let them try the real question
 * engine before they are asked for anything.
 */
export function PracticeHubPage() {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    void fetchPracticeGradeCounts().then(setCounts)
  }, [])

  useSeo({
    title: t('practice.seo.hubTitle'),
    description: t('practice.seo.hubDescription'),
    path: '/practice',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: t('practice.seo.hubTitle'),
      itemListElement: GRADES.map((grade, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t('practice.gradeLabel', { grade }),
        url: `https://studylegends.co.za/practice/grade-${grade}`,
      })),
    },
  })

  return (
    <MarketingShell>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-600">{t('practice.freeBadge')}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-slate-900">{t('practice.hubTitle')}</h1>
            <p className="mt-2 max-w-xl text-slate-600">{t('practice.hubIntro')}</p>
          </div>
          <PracticeLanguageToggle />
        </div>

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-600">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success-600" /> {t('practice.promise.free')}
          </li>
          <li className="flex items-center gap-2">
            <BookOpenCheck size={16} className="text-success-600" /> {t('practice.promise.explanations')}
          </li>
          <li className="flex items-center gap-2">
            <Languages size={16} className="text-success-600" /> {t('practice.promise.bilingual')}
          </li>
        </ul>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {GRADES.map((grade) => {
            const count = counts.get(grade) ?? 0
            return (
              <Link key={grade} to={`/practice/grade-${grade}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <p className="text-2xl font-extrabold text-slate-900">{t('practice.gradeLabel', { grade })}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {count > 0 ? t('practice.testCount', { count }) : t('practice.comingSoon')}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-12 rounded-3xl bg-brand-50 p-6">
          <h2 className="font-bold text-slate-900">{t('practice.upsellTitle')}</h2>
          <p className="mt-1.5 text-sm text-slate-600">{t('practice.upsellBody')}</p>
          <Link to="/pricing" className="mt-3 inline-block text-sm font-bold text-brand-700 underline">
            {t('practice.upsellCta')}
          </Link>
        </div>
      </div>
    </MarketingShell>
  )
}
