import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectMasterySummary, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { Card, ProgressRing } from '@/components/ui'

export function SubjectsPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const [subjects, setSubjects] = useState<SubjectMasterySummary[]>([])

  useEffect(() => {
    if (!activeLearner) return
    fetchSubjectMasterySummary(activeLearner.id, activeLearner.grade_id).then(setSubjects)
  }, [activeLearner])

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('subjects.title')}</h1>
      <div className="mt-4 space-y-3">
        {subjects.map((s) => (
          <Link key={s.subjectId} to={`/app/subjects/${s.subjectId}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{s.subjectName}</p>
                <p className="text-sm text-slate-500">
                  {Math.round(s.averageMastery)}% {t('subjects.mastery').toLowerCase()}
                </p>
              </div>
              <ProgressRing value={s.averageMastery} size={52} strokeWidth={6} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
