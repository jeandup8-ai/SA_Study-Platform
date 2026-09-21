import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { MarketingButton, PageHero, Section } from '@/components/marketing'
import { PracticeLanguageToggle } from '@/pages/practice/PracticeLanguageToggle'
import { PracticeBreadcrumbs } from '@/pages/practice/PracticeBreadcrumbs'
import {
  fetchPracticeTest,
  practiceTestTitle,
  practiceTestSummary,
  type PracticeTestDetail,
} from '@/lib/practice/queries'
import { localizedName } from '@/lib/i18n/localizedName'
import { useSeo } from '@/hooks/useSeo'
import { Button, Card, ProgressRing, SkeletonList } from '@/components/ui'
import type { LanguageCode } from '@/types/curriculum'

/**
 * A single free test. Every question is rendered into the page at once rather
 * than one-at-a-time like the in-app `QuestionRunner`: a crawler has to be able
 * to read the questions to rank the page for them, and a parent skimming before
 * exams wants to see the whole thing without clicking through.
 *
 * Marking is immediate and per question, and the explanation is always shown
 * after marking -- right or wrong. That is the one thing every competitor in
 * this space leads with, and the thing a downloadable PDF of past papers
 * cannot do.
 */
export function PracticeTestPage() {
  const { t, i18n } = useTranslation()
  const { gradeSlug, subjectSlug, testSlug } = useParams<{
    gradeSlug: string
    subjectSlug: string
    testSlug: string
  }>()
  const language = (i18n.language.startsWith('af') ? 'af' : 'en') as LanguageCode
  const [test, setTest] = useState<PracticeTestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})

  const gradeNumber = Number(gradeSlug?.replace('grade-', ''))
  const validGrade = Number.isInteger(gradeNumber) && gradeNumber >= 4 && gradeNumber <= 7

  useEffect(() => {
    if (!validGrade || !subjectSlug || !testSlug) return
    setLoading(true)
    void fetchPracticeTest(gradeNumber, subjectSlug, testSlug, language).then((row) => {
      setTest(row)
      setAnswers({})
      setMarked({})
      setLoading(false)
    })
  }, [gradeNumber, validGrade, subjectSlug, testSlug, language])

  /** "place-value" -> "Place value". Used for the heading and breadcrumbs
   * until the test itself arrives: falling back to the hub's title would put
   * "Free CAPS practice tests" at the top of a specific test, and a raw slug
   * reads as broken. The slug is derived from the real title, so this is
   * close to the final text and does not jump jarringly when it loads. */
  function humanise(slug: string | undefined): string {
    if (!slug) return ''
    const words = slug.replace(/-/g, ' ').trim()
    return words.charAt(0).toUpperCase() + words.slice(1)
  }

  const title = test ? practiceTestTitle(test, language) : humanise(testSlug)
  const subjectName = test
    ? localizedName({ name: test.subjectName, name_af: test.subjectNameAf }, language)
    : humanise(subjectSlug)

  const markedCount = Object.keys(marked).length
  const correctCount = useMemo(
    () =>
      (test?.questions ?? []).filter(
        (q) => marked[q.id] && q.options.find((o) => o.id === answers[q.id])?.is_correct,
      ).length,
    [test, marked, answers],
  )
  const allMarked =
    Boolean(test) && markedCount === test!.questions.length && markedCount > 0

  useSeo({
    title: t('practice.seo.testTitle', {
      grade: gradeNumber,
      title,
      subject: subjectName,
    }),
    description: t('practice.seo.testDescription', {
      grade: gradeNumber,
      title,
      count: test?.questionCount ?? 0,
    }),
    path: `/practice/grade-${gradeNumber}/${subjectSlug}/${testSlug}`,
    noIndex: !loading && !test,
    structuredData: test
      ? {
          '@context': 'https://schema.org',
          '@type': 'Quiz',
          name: title,
          educationalLevel: `Grade ${gradeNumber}`,
          about: { '@type': 'Thing', name: subjectName },
          inLanguage: test.servedLanguage === 'af' ? 'af-ZA' : 'en-ZA',
          isAccessibleForFree: true,
          hasPart: test.questions.map((q) => ({
            '@type': 'Question',
            eduQuestionType: 'Multiple choice',
            text: q.prompt,
            acceptedAnswer: {
              '@type': 'Answer',
              text: q.options.find((o) => o.is_correct)?.label ?? q.correct_answer ?? '',
            },
          })),
        }
      : undefined,
  })

  if (!validGrade || !subjectSlug || !testSlug) return <Navigate to="/practice" replace />

  function mark(questionId: string) {
    setMarked((prev) => ({ ...prev, [questionId]: true }))
  }

  return (
    <MarketingShell surface="dark">
      {/* Dark hero, then the questions on a light band. The band alternation
          is what makes this read as the same site as the landing page; the
          questions themselves stay dark-on-light because this is the one page
          here that someone actually sits and works through. */}
      <PageHero
        above={
          <PracticeBreadcrumbs
            items={[
              {
                label: t('practice.gradeLabel', { grade: gradeNumber }),
                to: `/practice/grade-${gradeNumber}`,
              },
              { label: subjectName, to: `/practice/grade-${gradeNumber}/${subjectSlug}` },
              { label: title || (testSlug ?? '') },
            ]}
          />
        }
        eyebrow={
          test
            ? t('practice.testMeta', {
                grade: gradeNumber,
                subject: subjectName,
                count: test.questions.length,
              })
            : t('practice.freeBadge')
        }
        title={title}
        lead={test ? (practiceTestSummary(test, language) ?? undefined) : undefined}
        aside={<PracticeLanguageToggle />}
      />

      <Section tone="light">
        <div className="mx-auto max-w-2xl">
          {loading && <SkeletonList count={4} label={t('common.loading')} />}

          {!loading && !test && (
            <div className="rounded-3xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-ink-500">
              <p>{t('practice.testNotFound')}</p>
              <Link
                to="/practice"
                className="mt-3 inline-block text-sm font-bold text-volt-700 underline"
              >
                {t('practice.breadcrumbRoot')}
              </Link>
            </div>
          )}

          {test && (
            <>
              {test.servedLanguage !== language && (
                <p className="mb-6 flex items-start gap-2 rounded-2xl bg-gold-50 p-3 text-sm text-gold-600">
                  <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                  {t('practice.languageFallback', {
                    wanted: t(`practice.languageName.${language}`),
                    served: t(`practice.languageName.${test.servedLanguage}`),
                  })}
                </p>
              )}

              <div className="space-y-4">
                {test.questions.map((question, index) => {
                  const selectedId = answers[question.id]
                  const isMarked = Boolean(marked[question.id])
                  const selected = question.options.find((o) => o.id === selectedId)
                  return (
                    <Card key={question.id}>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {t('practice.questionNumber', { number: index + 1 })}
                      </p>
                      <p className="mt-1.5 font-bold text-slate-900">{question.prompt}</p>

                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => {
                          const isSelected = selectedId === option.id
                          const showCorrect = isMarked && option.is_correct
                          const showIncorrect =
                            isMarked && isSelected && !option.is_correct
                          return (
                            <button
                              key={option.id}
                              type="button"
                              disabled={isMarked}
                              onClick={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [question.id]: option.id,
                                }))
                              }
                              className={`flex min-h-12 w-full items-center gap-2 rounded-2xl border-2 px-4 py-2 text-left font-semibold transition-colors ${
                                showCorrect
                                  ? 'border-success-500 bg-success-50 text-success-700'
                                  : showIncorrect
                                    ? 'border-danger-500 bg-danger-50 text-danger-700'
                                    : isSelected
                                      ? 'border-volt-500 bg-volt-50 text-volt-700'
                                      : 'border-slate-200 text-slate-700'
                              }`}
                            >
                              {showCorrect && (
                                <CheckCircle2 size={18} className="shrink-0" />
                              )}
                              {showIncorrect && (
                                <XCircle size={18} className="shrink-0" />
                              )}
                              <span>{option.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {!isMarked ? (
                        <Button
                          className="mt-4 w-full"
                          disabled={!selectedId}
                          onClick={() => mark(question.id)}
                        >
                          {t('lesson.checkAnswer')}
                        </Button>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                          <p
                            className={`text-sm font-bold ${
                              selected?.is_correct
                                ? 'text-success-600'
                                : 'text-danger-600'
                            }`}
                          >
                            {selected?.is_correct
                              ? t('lesson.correct')
                              : t('lesson.incorrect')}
                          </p>
                          {question.explanation && (
                            <p className="mt-1.5 text-sm text-slate-600">
                              {question.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>

              {markedCount > 0 && (
                <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-ink-200/70 bg-white p-6 text-center shadow-sm">
                  <ProgressRing
                    value={(correctCount / Math.max(test.questions.length, 1)) * 100}
                    size={96}
                    strokeWidth={9}
                  />
                  <p className="font-display text-lg font-extrabold text-ink-900">
                    {t('practice.scoreLine', {
                      correct: correctCount,
                      total: test.questions.length,
                    })}
                  </p>
                  {allMarked && (
                    <>
                      <p className="max-w-sm text-sm text-ink-500">
                        {t('practice.notSavedNotice')}
                      </p>
                      <MarketingButton
                        to="/sign-up"
                        variant="volt"
                        size="md"
                        className="w-full max-w-xs"
                      >
                        {t('practice.saveProgressCta')}
                      </MarketingButton>
                      <Link
                        to={`/practice/grade-${gradeNumber}/${subjectSlug}`}
                        className="text-sm font-bold text-volt-700 underline"
                      >
                        {t('practice.moreTests')}
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Section>
    </MarketingShell>
  )
}
