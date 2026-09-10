import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, BookOpen } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchTopicsWithProgress, type TopicWithProgress } from '@/lib/curriculum/topics'
import { localizedName } from '@/lib/i18n/localizedName'
import { fetchPrintablePracticeSet } from '@/lib/curriculum/printable'
import { generatePracticeSheetPdf } from '@/lib/pdf/practiceSheet'
import { fetchTopicSummaryContent } from '@/lib/curriculum/topicSummary'
import { generateTopicSummaryPdf } from '@/lib/pdf/topicSummarySheet'
import { supabase } from '@/lib/supabase'
import { Card, ProgressRing, Badge } from '@/components/ui'

export function TopicListPage() {
  const { t } = useTranslation()
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeLearner } = useLearner()
  const [topics, setTopics] = useState<TopicWithProgress[]>([])
  const [subjectName, setSubjectName] = useState('')
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!activeLearner || !subjectId) return
    fetchTopicsWithProgress(subjectId, activeLearner.grade_id, activeLearner.id, activeLearner.preferred_language).then(
      setTopics,
    )
    supabase
      .from('subjects')
      .select('name, name_af')
      .eq('id', subjectId)
      .maybeSingle()
      .then(({ data }) => setSubjectName(data ? localizedName(data, activeLearner.preferred_language) : ''))
  }, [activeLearner, subjectId])

  async function handleDownloadPracticeSheet(event: React.MouseEvent, topic: TopicWithProgress) {
    event.preventDefault()
    event.stopPropagation()
    if (!activeLearner || downloadingKey) return
    const key = `${topic.id}:practice`
    setDownloadingKey(key)
    try {
      const questions = await fetchPrintablePracticeSet(topic.id, activeLearner.preferred_language)
      if (questions.length > 0) {
        await generatePracticeSheetPdf({
          subjectName,
          topicName: topic.name,
          questions,
          labels: {
            brand: t('common.appName'),
            practiceSheetTitle: t('subjects.practiceSheetTitle'),
            answerMemoTitle: t('subjects.answerMemoTitle'),
            questionLabel: t('subjects.pdfQuestionLabel'),
            writeYourAnswer: t('subjects.writeYourAnswer'),
          },
        })
      }
    } finally {
      setDownloadingKey(null)
    }
  }

  async function handleDownloadSummary(event: React.MouseEvent, topic: TopicWithProgress) {
    event.preventDefault()
    event.stopPropagation()
    if (!activeLearner || downloadingKey) return
    const key = `${topic.id}:summary`
    setDownloadingKey(key)
    try {
      const content = await fetchTopicSummaryContent(topic.id, activeLearner.preferred_language)
      if (content.narrationParagraphs.length > 0 || content.workedExample || content.keyTerms.length > 0) {
        await generateTopicSummaryPdf({
          subjectName,
          topicName: topic.name,
          ...content,
          labels: {
            brand: t('common.appName'),
            keyTermsHeading: t('subjects.keyTermsHeading'),
            summaryHeading: t('subjects.summaryHeading'),
            workedExampleHeading: t('subjects.workedExampleHeading'),
            aiGeneratedNotice: t('lesson.aiGeneratedNotice'),
          },
        })
      }
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{subjectName}</h1>
      <p className="text-sm text-slate-500">{t('subjects.topics')}</p>
      <div className="mt-4 space-y-3">
        {topics.map((topic) => (
          <Link key={topic.id} to={`/app/subjects/${subjectId}/topics/${topic.id}`}>
            <Card>
              <div className="flex items-center justify-between gap-2">
                {topic.illustrationUrl && (
                  <img
                    src={topic.illustrationUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{topic.name}</p>
                  <p className="text-sm text-slate-500">
                    {t('subjects.lessonsAvailable', { count: topic.lessonCount })}
                  </p>
                  {topic.is_demo_content && (
                    <Badge tone="warning">{t('common.demoContent')}</Badge>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => void handleDownloadSummary(e, topic)}
                  disabled={downloadingKey === `${topic.id}:summary`}
                  aria-label={t('subjects.downloadSummary')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                >
                  {downloadingKey === `${topic.id}:summary` ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  ) : (
                    <BookOpen size={16} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleDownloadPracticeSheet(e, topic)}
                  disabled={downloadingKey === `${topic.id}:practice`}
                  aria-label={t('subjects.downloadPracticeSheet')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-50"
                >
                  {downloadingKey === `${topic.id}:practice` ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  ) : (
                    <Download size={16} />
                  )}
                </button>
                <ProgressRing value={topic.masteryScore} size={44} strokeWidth={5} />
              </div>
            </Card>
          </Link>
        ))}
        {topics.length === 0 && (
          <p className="text-sm text-slate-400">{t('subjects.noTopicsYet')}</p>
        )}
      </div>
    </div>
  )
}
