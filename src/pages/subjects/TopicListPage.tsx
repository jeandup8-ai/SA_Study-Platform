import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchTopicsWithProgress, type TopicWithProgress } from '@/lib/curriculum/topics'
import { supabase } from '@/lib/supabase'
import { Card, ProgressRing, Badge } from '@/components/ui'

export function TopicListPage() {
  const { t } = useTranslation()
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeLearner } = useLearner()
  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [subjectName, setSubjectName] = useState('')

  useEffect(() => {
    if (!activeLearner || !subjectId) return
    fetchTopicsWithProgress(subjectId, activeLearner.grade_id, activeLearner.id).then(setTopics)
    supabase
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .maybeSingle()
      .then(({ data }) => setSubjectName(data?.name ?? ''))
  }, [activeLearner, subjectId])

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{subjectName}</h1>
      <p className="text-sm text-slate-500">{t('subjects.topics')}</p>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => (
          <Link key={topic.id} to={`/app/subjects/${subjectId}/topics/${topic.id}`}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">{topic.name}</p>
                  <p className="text-sm text-slate-500">
                    {t('subjects.lessonsAvailable', { count: topic.lessonCount })}
                  </p>
                  {topic.is_demo_content && (
                    <Badge tone="warning">{t('common.demoContent')}</Badge>
                  )}
                </div>
                <ProgressRing value={topic.masteryScore} size={44} strokeWidth={5} />
              </div>
            </Card>
          </Link>
        ))}
        {topics.length === 0 && (
          <p className="text-sm text-slate-400">No topics published for this subject yet.</p>
        )}
      </div>
    </div>
  )
}
