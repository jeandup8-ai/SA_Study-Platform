import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@/components/ui'
import type { PracticeQuestion } from '@/lib/curriculum/lessonV2'

/**
 * V2.3 practice questions are free-text (no multiple-choice options), so
 * they can't run through the graded QuestionRunner/mastery pipeline. This is
 * an honest self-check instead: think it through, then reveal the answer.
 */
export function PracticeSelfCheck({
  questions,
  onComplete,
}: {
  questions: PracticeQuestion[]
  onComplete: () => void
}) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [showHint, setShowHint] = useState(false)

  if (questions.length === 0) return null
  const question = questions[index]
  const isLast = index === questions.length - 1

  function next() {
    if (isLast) {
      onComplete()
      return
    }
    setIndex((i) => i + 1)
    setRevealed(false)
    setShowHint(false)
  }

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-500">
        {t('lesson.questionOf', { current: index + 1, total: questions.length })}
      </p>
      <p className="mt-2 font-bold text-slate-800">{question.question}</p>

      {!revealed && (
        <div className="mt-4 flex flex-wrap gap-2">
          {question.hint && !showHint && (
            <Button variant="secondary" size="md" onClick={() => setShowHint(true)}>
              {t('lesson.showHint')}
            </Button>
          )}
          <Button size="md" onClick={() => setRevealed(true)}>
            {t('lesson.showAnswer')}
          </Button>
        </div>
      )}

      {showHint && !revealed && (
        <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">{question.hint}</p>
      )}

      {revealed && (
        <>
          <div className="mt-4 rounded-xl bg-success-50 px-4 py-3 text-success-600">{question.correct_answer}</div>
          <Button className="mt-4 w-full" onClick={next}>
            {isLast ? t('common.continue') : t('lesson.nextQuestion')}
          </Button>
        </>
      )}
    </Card>
  )
}
