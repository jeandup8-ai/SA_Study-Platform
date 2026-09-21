import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle2, Languages, BookOpenCheck } from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { fetchPracticeGradeCounts } from '@/lib/practice/queries'
import { useSeo } from '@/hooks/useSeo'
import {
  MarketingButton,
  PageHero,
  Reveal,
  Section,
  SectionHeading,
} from '@/components/marketing'

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
    <MarketingShell surface="dark">
      <PageHero
        eyebrow={t('practice.freeBadge')}
        title={t('practice.hubTitle')}
        lead={t('practice.hubIntro')}
        aside={<PracticeLanguageToggle />}
      >
        <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-ink-200">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-volt-300" aria-hidden />
            {t('practice.promise.free')}
          </li>
          <li className="flex items-center gap-2">
            <BookOpenCheck size={16} className="text-volt-300" aria-hidden />
            {t('practice.promise.explanations')}
          </li>
          <li className="flex items-center gap-2">
            <Languages size={16} className="text-volt-300" aria-hidden />
            {t('practice.promise.bilingual')}
          </li>
        </ul>
      </PageHero>

      <Section tone="light">
        <div className="grid gap-4 sm:grid-cols-2">
          {GRADES.map((grade, i) => {
            const count = counts.get(grade) ?? 0
            return (
              <Reveal key={grade} delay={i * 60}>
                <Link
                  to={`/practice/grade-${grade}`}
                  className="group flex h-full items-center justify-between gap-4 rounded-3xl border border-ink-200/70 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-volt-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300"
                >
                  <span className="min-w-0">
                    <span className="font-display block text-2xl font-extrabold text-ink-900">
                      {t('practice.gradeLabel', { grade })}
                    </span>
                    <span className="mt-1 block text-sm text-ink-500">
                      {count > 0
                        ? t('practice.testCount', { count })
                        : t('practice.comingSoon')}
                    </span>
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
      </Section>

      <Section tone="dark">
        <SectionHeading
          title={t('practice.upsellTitle')}
          lead={t('practice.upsellBody')}
        />
        <Reveal delay={120} className="mt-8">
          <MarketingButton to="/pricing" variant="volt">
            {t('practice.upsellCta')}
            <ArrowRight size={18} aria-hidden />
          </MarketingButton>
        </Reveal>
      </Section>
    </MarketingShell>
  )
}
