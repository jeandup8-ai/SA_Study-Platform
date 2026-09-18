import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, PlayCircle, BookOpen } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchLessonsForTopic } from '@/lib/curriculum/queries'
import { localizedName } from '@/lib/i18n/localizedName'
import { supabase } from '@/lib/supabase'
import {
  PageHeader,
  Stagger,
  SkeletonList,
  EmptyState,
  ErrorState,
  linkCardClass,
} from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'
import type { Lesson, LearnerProgress } from '@/types/curriculum'

interface LessonListData {
  lessons: Lesson[]
  progressByLesson: Map<string, LearnerProgress>
  topicName: string
}

export function LessonListPage() {
  const { t } = useTranslation()
  const { topicId } = useParams<{ subjectId: string; topicId: string }>()
  const { activeLearner } = useLearner()
  const learnerId = activeLearner?.id ?? null

  const { status, data, reload } = useAsync<LessonListData>(
    async () => {
      const learner = activeLearner!
      const [lessons, topicRow] = await Promise.all([
        fetchLessonsForTopic(topicId!, learner.preferred_language),
        supabase.from('topics').select('name, name_af').eq('id', topicId!).maybeSingle(),
      ])
      const { data: progress } = await supabase
        .from('learner_progress')
        .select('*')
        .eq('learner_id', learner.id)
        .in(
          'lesson_id',
          lessons.map((l) => l.id),
        )
      return {
        lessons,
        progressByLesson: new Map((progress ?? []).map((p) => [p.lesson_id, p])),
        topicName: topicRow.data ? localizedName(topicRow.data, learner.preferred_language) : '',
      }
    },
    [learnerId, topicId],
    { enabled: Boolean(activeLearner && topicId) },
  )

  const topicName = data?.topicName ?? ''

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <PageHeader eyebrow={t('subjects.title')} title={topicName} />

      {status === 'error' ? (
        <ErrorState className="mt-4" onRetry={reload} />
      ) : status === 'success' && data && data.lessons.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<BookOpen size={22} />}
          title={t('subjects.emptyLessonsTitle')}
          body={t('subjects.emptyLessonsBody')}
        />
      ) : status === 'success' && data ? (
        <>
          <div className="mt-4 space-y-3">
            {data.lessons.map((lesson, i) => {
              const lessonStatus = data.progressByLesson.get(lesson.id)?.status ?? 'not_started'
              // lessons.title is an English-only column with no Afrikaans
              // sibling. Almost every topic has exactly one lesson, so the
              // topic name (already localized above) is a safe, correctly
              // localized stand-in; only fall back to the raw English title
              // where a topic has more than one lesson and they need to read
              // differently.
              const label = data.lessons.length > 1 ? lesson.title : topicName || lesson.title
              return (
                <Stagger key={lesson.id} index={i}>
                  <Link
                    to={`/app/lessons/${lesson.id}`}
                    className={linkCardClass({ className: 'flex items-center gap-3' })}
                  >
                    <StatusIcon status={lessonStatus} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-slate-900 break-words">{label}</p>
                      <p className="text-sm text-slate-500">{lesson.estimated_minutes} min</p>
                    </div>
                  </Link>
                </Stagger>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-slate-400">{t('common.demoContent')}</p>
        </>
      ) : (
        <SkeletonList className="mt-4" count={3} label={t('common.loadingLessons')} />
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="shrink-0 text-success-500" size={26} />
  if (status === 'in_progress') return <PlayCircle className="shrink-0 text-volt-500" size={26} />
  return <Circle className="shrink-0 text-slate-300" size={26} />
}
