import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchQuestionsForSubject } from '@/lib/curriculum/questions'
import { recordMockTestResult } from '@/lib/mastery/engine'
import { QuestionRunner, type QuestionWithOptions, type QuestionAnswerRecord } from '@/components/lesson/QuestionRunner'
import { Button, Card, ProgressRing } from '@/components/ui'

export function MockTestPage() {
  const { t } = useTranslation()
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeLearner } = useLearner()
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([])
  const [result, setResult] = useState<{ correctCount: number; total: number } | null>(null)
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

  async function handleComplete(res: { correctCount: number; total: number; answers: QuestionAnswerRecord[] }) {
    if (!activeLearner || !subjectId) return
    setResult(res)
    await recordMockTestResult({
      learnerId: activeLearner.id,
      subjectId,
      questionsWithTopic: questions.map((q) => ({ questionId: q.id, topicId: q.topic_id })),
      answers: res.answers,
      sessionStartedAt,
    })
  }

  if (!activeLearner) return null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('exam.mockTest')}</h1>

      {!result && questions.length > 0 && <QuestionRunner questions={questions} onComplete={handleComplete} />}

      {!result && questions.length === 0 && (
        <Card className="mt-6 text-center text-sm text-slate-400">No questions published for this subject yet.</Card>
      )}

      {result && (
        <Card className="mt-6 flex flex-col items-center gap-3 text-center">
          <ProgressRing value={(result.correctCount / Math.max(result.total, 1)) * 100} size={96} strokeWidth={9} />
          <p className="text-slate-600">
            {t('quiz.score', { score: Math.round((result.correctCount / Math.max(result.total, 1)) * 100) })}
          </p>
          <Link to="/app/exam" className="mt-2 w-full">
            <Button className="w-full">{t('common.back')}</Button>
          </Link>
        </Card>
      )}
    </div>
  )
}
