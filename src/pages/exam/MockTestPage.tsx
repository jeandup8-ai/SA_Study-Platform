import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchQuestionsForSubject } from '@/lib/curriculum/questions'
import { recordMockTestResult } from '@/lib/mastery/engine'
import {
  QuestionRunner,
  type QuestionWithOptions,
  type QuestionAnswerRecord,
} from '@/components/lesson/QuestionRunner'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressRing,
  Skeleton,
} from '@/components/ui'
import { FileQuestion } from 'lucide-react'

export function MockTestPage() {
  const { t } = useTranslation()
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeLearner } = useLearner()
  const [questions, setQuestions] = useState<QuestionWithOptions[] | null>(null)
  const [result, setResult] = useState<{ correctCount: number; total: number } | null>(
    null,
  )
  const [sessionStartedAt] = useState(() => new Date())

  useEffect(() => {
    if (!activeLearner || !subjectId) return
    fetchQuestionsForSubject({
      subjectId,
      gradeId: activeLearner.grade_id,
      language: activeLearner.preferred_language,
      limit: 8,
    }).then(setQuestions)
  }, [activeLearner, subjectId])

  async function handleComplete(res: {
    correctCount: number
    total: number
    answers: QuestionAnswerRecord[]
  }) {
    if (!activeLearner || !subjectId) return
    setResult(res)
    await recordMockTestResult({
      learnerId: activeLearner.id,
      subjectId,
      questionsWithTopic: (questions ?? []).map((q) => ({
        questionId: q.id,
        topicId: q.topic_id,
      })),
      answers: res.answers,
      sessionStartedAt,
    })
  }

  if (!activeLearner) return null

  return (
    <div className="app-column pt-6 pb-10">
      <PageHeader eyebrow={t('nav.exam')} title={t('exam.mockTest')} />

      {/* `questions` is null until the query returns. Starting it as an
          empty array meant the "there are no questions yet" card rendered
          first every time, so a learner opening a mock test was told the
          subject had nothing in it and then watched the test appear. */}
      {!result && questions === null && (
        <div
          className="mt-6 space-y-3"
          role="status"
          aria-busy="true"
          aria-label={t('common.loading')}
        >
          <Skeleton className="h-40 w-full rounded-3xl" />
          <span className="sr-only">{t('common.loading')}</span>
        </div>
      )}

      {!result && questions !== null && questions.length > 0 && (
        <div className="mt-6">
          <QuestionRunner questions={questions} onComplete={handleComplete} />
        </div>
      )}

      {!result && questions !== null && questions.length === 0 && (
        <EmptyState
          className="mt-6"
          icon={<FileQuestion size={22} />}
          title={t('exam.noQuestionsYet')}
          body={t('exam.noQuestionsYetBody')}
          action={
            <Link to="/app/exam">
              <Button variant="secondary">{t('common.back')}</Button>
            </Link>
          }
        />
      )}

      {result && (
        <Card className="mt-6 flex flex-col items-center gap-3 text-center">
          <ProgressRing
            value={(result.correctCount / Math.max(result.total, 1)) * 100}
            size={96}
            strokeWidth={9}
          />
          <p className="text-slate-600">
            {t('quiz.score', {
              score: Math.round((result.correctCount / Math.max(result.total, 1)) * 100),
            })}
          </p>
          <Link to="/app/exam" className="mt-2 w-full">
            <Button className="w-full">{t('common.back')}</Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
