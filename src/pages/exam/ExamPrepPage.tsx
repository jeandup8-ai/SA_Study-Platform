import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectsForGrade } from '@/lib/curriculum/queries'
import { computeExamReadiness, type ExamReadiness } from '@/lib/exam/readiness'
import { Card, Badge, Button, ProgressRing } from '@/components/ui'
import type { Subject } from '@/types/curriculum'

export function ExamPrepPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [readiness, setReadiness] = useState<ExamReadiness | null>(null)

  useEffect(() => {
    if (activeLearner) fetchSubjectsForGrade(activeLearner.grade_id).then(setSubjects)
  }, [activeLearner])

  useEffect(() => {
    if (activeLearner && selectedSubject) {
      computeExamReadiness(activeLearner.id, selectedSubject.id, activeLearner.grade_id).then(setReadiness)
    }
  }, [activeLearner, selectedSubject])

  if (!activeLearner) return null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('exam.title')}</h1>

      <p className="mt-4 text-sm font-semibold text-slate-500">{t('exam.selectSubject')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSubject(s)}
            className={`min-h-10 rounded-full border-2 px-4 text-sm font-semibold ${
              selectedSubject?.id === s.id
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {selectedSubject && readiness && (
        <div className="mt-6 space-y-4">
          <Card className="flex items-center gap-4">
            <ProgressRing value={readiness.readinessScore} size={80} strokeWidth={8} />
            <p className="font-bold text-slate-800">
              {t('exam.readinessTitle', { subject: selectedSubject.name })}
            </p>
          </Card>

          <TopicGroup label={t('exam.strong')} tone="success" items={readiness.strong} />
          <TopicGroup label={t('exam.needsRevision')} tone="warning" items={readiness.needsRevision} />
          <TopicGroup label={t('exam.weak')} tone="danger" items={readiness.weak} />

          <div className="flex gap-3">
            {readiness.weak[0] && (
              <Link to={`/app/subjects/${selectedSubject.id}/topics/${readiness.weak[0].topicId}`} className="flex-1">
                <Button className="w-full" variant="secondary">
                  {t('exam.startRevision')}
                </Button>
              </Link>
            )}
            <Link to={`/app/exam/${selectedSubject.id}/mock-test`} className="flex-1">
              <Button className="w-full">{t('exam.mockTest')}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function TopicGroup({
  label,
  tone,
  items,
}: {
  label: string
  tone: 'success' | 'warning' | 'danger'
  items: { topicId: string; name: string; score: number }[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item.topicId} tone={tone}>
            {item.name}
          </Badge>
        ))}
      </div>
    </div>
  )
}
