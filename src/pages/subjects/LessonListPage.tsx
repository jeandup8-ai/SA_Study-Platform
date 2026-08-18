import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Circle, PlayCircle } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchLessonsForTopic } from '@/lib/curriculum/queries'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui'
import type { Lesson, LearnerProgress } from '@/types/curriculum'

export function LessonListPage() {
  const { t } = useTranslation()
  const { topicId } = useParams<{ subjectId: string; topicId: string }>()
  const { activeLearner } = useLearner()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressByLesson, setProgressByLesson] = useState<Map<string, LearnerProgress>>(new Map())
  const [topicName, setTopicName] = useState('')

  useEffect(() => {
    if (!activeLearner || !topicId) return
    fetchLessonsForTopic(topicId, activeLearner.preferred_language).then(async (ls) => {
      setLessons(ls)
      const { data: progress } = await supabase
        .from('learner_progress')
        .select('*')
        .eq('learner_id', activeLearner.id)
        .in('lesson_id', ls.map((l) => l.id))
      setProgressByLesson(new Map((progress ?? []).map((p) => [p.lesson_id, p])))
    })
    supabase
      .from('topics')
      .select('name')
      .eq('id', topicId)
      .maybeSingle()
      .then(({ data }) => setTopicName(data?.name ?? ''))
  }, [activeLearner, topicId])

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{topicName}</h1>
      <div className="mt-4 space-y-3">
        {lessons.map((lesson) => {
          const status = progressByLesson.get(lesson.id)?.status ?? 'not_started'
          return (
            <Link key={lesson.id} to={`/app/lessons/${lesson.id}`}>
              <Card className="flex items-center gap-3">
                <StatusIcon status={status} />
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{lesson.title}</p>
                  <p className="text-sm text-slate-500">{lesson.estimated_minutes} min</p>
                </div>
              </Card>
            </Link>
          )
        })}
        {lessons.length === 0 && (
          <p className="text-sm text-slate-400">No lessons published for this topic yet.</p>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-400">{t('common.demoContent')}</p>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="text-success-500" size={26} />
  if (status === 'in_progress') return <PlayCircle className="text-brand-500" size={26} />
  return <Circle className="text-slate-300" size={26} />
}
