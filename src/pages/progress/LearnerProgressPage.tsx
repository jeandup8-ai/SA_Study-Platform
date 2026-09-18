import { useTranslation } from 'react-i18next'
import { Target, CheckCircle2, TrendingUp } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectMasterySummary, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { supabase } from '@/lib/supabase'
import {
  Card,
  ProgressRing,
  PageHeader,
  SectionLabel,
  StatTile,
  Stagger,
  SkeletonList,
  EmptyState,
  ErrorState,
} from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

interface ProgressData {
  subjects: SubjectMasterySummary[]
  lessonsCompleted: number
}

export function LearnerProgressPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const learnerId = activeLearner?.id ?? null

  const { status, data, reload } = useAsync<ProgressData>(
    async () => {
      const learner = activeLearner!
      const [subjects, countRow] = await Promise.all([
        fetchSubjectMasterySummary(learner.id, learner.grade_id),
        supabase
          .from('learner_progress')
          .select('id', { count: 'exact', head: true })
          .eq('learner_id', learner.id)
          .eq('status', 'completed'),
      ])
      return { subjects, lessonsCompleted: countRow.count ?? 0 }
    },
    [learnerId],
    { enabled: Boolean(activeLearner) },
  )

  if (!activeLearner) return null

  const subjects = data?.subjects ?? []
  const overall =
    subjects.length > 0
      ? subjects.reduce((sum, s) => sum + s.averageMastery, 0) / subjects.length
      : 0

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <PageHeader eyebrow={t('nav.progress')} title={t('dashboard.myProgress')} />

      {status === 'error' ? (
        <ErrorState className="mt-4" onRetry={reload} />
      ) : status === 'success' && data ? (
        <>
          <Card className="mt-4 flex items-center gap-4">
            <ProgressRing value={overall} size={72} strokeWidth={7} />
            <div className="min-w-0">
              <p className="font-display text-lg font-extrabold text-slate-900">
                {Math.round(overall)}%
              </p>
              <p className="text-sm text-slate-500">{t('parent.overallMastery')}</p>
            </div>
          </Card>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile
              icon={<CheckCircle2 size={16} />}
              tone="brand"
              label={t('parent.lessonsCompleted')}
              value={data.lessonsCompleted}
            />
            <StatTile
              icon={<Target size={16} />}
              tone="gold"
              label={t('subjects.title')}
              value={subjects.length}
            />
          </div>

          <SectionLabel className="mt-8">{t('subjects.mastery')}</SectionLabel>
          {subjects.length === 0 ? (
            <EmptyState
              className="mt-3"
              icon={<TrendingUp size={22} />}
              title={t('subjects.emptyTitle')}
              body={t('subjects.emptyBody')}
            />
          ) : (
            <div className="mt-3 space-y-3">
              {subjects.map((s, i) => (
                <Stagger key={s.subjectId} index={i}>
                  <Card className="flex items-center justify-between gap-3">
                    <p className="min-w-0 font-semibold text-slate-800 break-words">
                      {s.subjectName}
                    </p>
                    <ProgressRing value={s.averageMastery} size={44} strokeWidth={5} />
                  </Card>
                </Stagger>
              ))}
            </div>
          )}
        </>
      ) : (
        <SkeletonList className="mt-4" count={4} label={t('common.loadingProgress')} />
      )}
    </div>
  )
}
