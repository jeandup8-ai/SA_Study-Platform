import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Badge } from '@/components/ui'
import type { Question, QuestionOption } from '@/types/curriculum'

export interface QuestionWithOptions extends Question {
  options: QuestionOption[]
}

export interface QuestionAnswerRecord {
  questionId: string
  selectedOptionId: string | null
  isCorrect: boolean
}

interface QuestionRunnerProps {
  questions: QuestionWithOptions[]
  onComplete: (result: { correctCount: number; total: number; answers: QuestionAnswerRecord[] }) => void
}

export function QuestionRunner({ questions, onComplete }: QuestionRunnerProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<QuestionAnswerRecord[]>([])

  const question = questions[index]
  if (!question) return null

  const selectedOption = question.options.find((o) => o.id === selectedOptionId)

  function checkAnswer() {
    if (!selectedOption) return
    setRevealed(true)
    setAnswers((prev) => [
      ...prev,
      { questionId: question.id, selectedOptionId: selectedOption.id, isCorrect: selectedOption.is_correct },
    ])
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1)
      setSelectedOptionId(null)
      setRevealed(false)
    } else {
      const correctCount = answers.filter((a) => a.isCorrect).length
      onComplete({ correctCount, total: questions.length, answers })
    }
  }

  return (
    <Card>
      <p className="text-sm font-semibold text-slate-400">
        {t('quiz.questionOf', { current: index + 1, total: questions.length })}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-900">{question.prompt}</p>

      <div className="mt-4 space-y-2">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id
          const showCorrect = revealed && option.is_correct
          const showIncorrect = revealed && isSelected && !option.is_correct
          return (
            <button
              key={option.id}
              type="button"
              disabled={revealed}
              onClick={() => setSelectedOptionId(option.id)}
              className={`min-h-12 w-full rounded-2xl border-2 px-4 text-left font-semibold transition-colors ${
                showCorrect
                  ? 'border-success-500 bg-success-50 text-success-700'
                  : showIncorrect
                    ? 'border-danger-500 bg-danger-50 text-danger-700'
                    : isSelected
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-700'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <Badge tone={selectedOption?.is_correct ? 'success' : 'danger'}>
            {selectedOption?.is_correct ? t('lesson.correct') : t('lesson.incorrect')}
          </Badge>
          {question.explanation && <p className="mt-2 text-sm text-slate-600">{question.explanation}</p>}
        </div>
      )}

      <div className="mt-5">
        {!revealed ? (
          <Button className="w-full" disabled={!selectedOptionId} onClick={checkAnswer}>
            {t('lesson.checkAnswer')}
          </Button>
        ) : (
          <Button className="w-full" onClick={next}>
            {index + 1 < questions.length ? t('lesson.anotherQuestion') : t('quiz.submit')}
          </Button>
        )}
      </div>
    </Card>
  )
}
