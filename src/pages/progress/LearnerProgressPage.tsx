import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectMasterySummary, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { supabase } from '@/lib/supabase'
import { Card, ProgressRing } from '@/components/ui'

export function LearnerProgressPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const [subjects, setSubjects] = useState<SubjectMasterySummary[]>([])
  const [lessonsCompleted, setLessonsCompleted] = useState(0)

  useEffect(() => {
    if (!activeLearner) return
    fetchSubjectMasterySummary(activeLearner.id, activeLearner.grade_id).then(setSubjects)
    supabase
      .from('learner_progress')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', activeLearner.id)
      .eq('status', 'completed')
      .then(({ count }) => setLessonsCompleted(count ?? 0))
  }, [activeLearner])

  if (!activeLearner) return null

  const overall =
    subjects.length > 0 ? subjects.reduce((sum, s) => sum + s.averageMastery, 0) / subjects.length : 0

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('dashboard.myProgress')}</h1>

      <Card className="mt-4 flex items-center gap-4">
        <ProgressRing value={overall} size={72} strokeWidth={7} />
        <div>
          <p className="text-sm text-slate-500">{t('parent.overallMastery')}</p>
          <p className="text-sm text-slate-500">
            {t('parent.lessonsCompleted')}: <span className="font-bold text-slate-700">{lessonsCompleted}</span>
          </p>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {subjects.map((s) => (
          <Card key={s.subjectId} className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{s.subjectName}</p>
            <ProgressRing value={s.averageMastery} size={44} strokeWidth={5} />
          </Card>
        ))}
      </div>
    </div>
  )
}
