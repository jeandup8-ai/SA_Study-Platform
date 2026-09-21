import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import {
  fetchSubjectMasterySummary,
  type SubjectMasterySummary,
} from '@/lib/curriculum/dashboard'
import {
  ProgressRing,
  PageHeader,
  Stagger,
  SkeletonList,
  EmptyState,
  ErrorState,
  linkCardClass,
} from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

export function SubjectsPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const learnerId = activeLearner?.id ?? null

  const { status, data, reload } = useAsync<SubjectMasterySummary[]>(
    () =>
      fetchSubjectMasterySummary(
        activeLearner!.id,
        activeLearner!.grade_id,
        activeLearner!.preferred_language,
      ),
    [learnerId],
    { enabled: Boolean(activeLearner) },
  )

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <PageHeader eyebrow={t('nav.subjects')} title={t('subjects.title')} />

      {status === 'error' ? (
        <ErrorState className="mt-4" onRetry={reload} />
      ) : status === 'success' && data && data.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<BookOpen size={22} />}
          title={t('subjects.emptyTitle')}
          body={t('subjects.emptyBody')}
        />
      ) : status === 'success' && data ? (
        <div className="mt-4 space-y-3">
          {data.map((s, i) => (
            <Stagger key={s.subjectId} index={i}>
              <Link
                to={`/app/subjects/${s.subjectId}`}
                className={linkCardClass({
                  className: 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3',
                })}
              >
                <div className="min-w-0">
                  <p className="font-display font-bold text-slate-900 break-words">
                    {s.subjectName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {Math.round(s.averageMastery)}% {t('subjects.mastery').toLowerCase()}
                  </p>
                </div>
                <ProgressRing value={s.averageMastery} size={52} strokeWidth={6} />
              </Link>
            </Stagger>
          ))}
        </div>
      ) : (
        <SkeletonList className="mt-4" count={4} label={t('common.loadingSubjects')} />
      )}
    </div>
  )
}
