import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Download, BookOpen, Layers } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchTopicsWithProgress, type TopicWithProgress } from '@/lib/curriculum/topics'
import { localizedName } from '@/lib/i18n/localizedName'
import { fetchPrintablePracticeSet } from '@/lib/curriculum/printable'
import { generatePracticeSheetPdf } from '@/lib/pdf/practiceSheet'
import { fetchTopicSummaryContent } from '@/lib/curriculum/topicSummary'
import { generateTopicSummaryPdf } from '@/lib/pdf/topicSummarySheet'
import { supabase } from '@/lib/supabase'
import {
  Card,
  ProgressRing,
  Badge,
  PageHeader,
  Stagger,
  SkeletonList,
  EmptyState,
  ErrorState,
} from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

interface TopicListData {
  topics: TopicWithProgress[]
  subjectName: string
}

export function TopicListPage() {
  const { t } = useTranslation()
  const { subjectId } = useParams<{ subjectId: string }>()
  const { activeLearner } = useLearner()
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  const learnerId = activeLearner?.id ?? null
  const { status, data, reload } = useAsync<TopicListData>(
    async () => {
      const learner = activeLearner!
      const [topics, subjectRow] = await Promise.all([
        fetchTopicsWithProgress(subjectId!, learner.grade_id, learner.id, learner.preferred_language),
        supabase.from('subjects').select('name, name_af').eq('id', subjectId!).maybeSingle(),
      ])
      return {
        topics,
        subjectName: subjectRow.data
          ? localizedName(subjectRow.data, learner.preferred_language)
          : '',
      }
    },
    [learnerId, subjectId],
    { enabled: Boolean(activeLearner && subjectId) },
  )

  const subjectName = data?.subjectName ?? ''

  async function handleDownloadPracticeSheet(topic: TopicWithProgress) {
    if (!activeLearner || downloadingKey) return
    setDownloadingKey(`${topic.id}:practice`)
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

  async function handleDownloadSummary(topic: TopicWithProgress) {
    if (!activeLearner || downloadingKey) return
    setDownloadingKey(`${topic.id}:summary`)
    try {
      const content = await fetchTopicSummaryContent(topic.id, activeLearner.preferred_language)
      if (
        content.narrationParagraphs.length > 0 ||
        content.workedExample ||
        content.keyTerms.length > 0
      ) {
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
      <PageHeader eyebrow={t('subjects.topics')} title={subjectName || t('subjects.title')} />

      {status === 'error' ? (
        <ErrorState className="mt-4" onRetry={reload} />
      ) : status === 'success' && data && data.topics.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Layers size={22} />}
          title={t('subjects.emptyTopicsTitle')}
          body={t('subjects.emptyTopicsBody')}
        />
      ) : status === 'success' && data ? (
        <div className="mt-4 space-y-3">
          {data.topics.map((topic, i) => (
            <Stagger key={topic.id} index={i}>
              {/* The card is a plain container, not a link. The topic title is
                  the link and the two download controls are buttons beside it
                  -- nesting buttons inside an anchor is invalid HTML and made
                  keyboard activation of the downloads unreliable. */}
              <Card className="flex items-center gap-3">
                {topic.illustrationUrl && (
                  <img
                    src={topic.illustrationUrl}
                    alt=""
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/subjects/${subjectId}/topics/${topic.id}`}
                    className="font-display font-bold text-slate-900 break-words hover:text-volt-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400 focus-visible:ring-offset-2 rounded"
                  >
                    {topic.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {t('subjects.lessonsAvailable', { count: topic.lessonCount })}
                  </p>
                  {topic.is_demo_content && <Badge tone="warning">{t('common.demoContent')}</Badge>}
                </div>
                <IconButton
                  label={t('subjects.downloadSummary')}
                  busy={downloadingKey === `${topic.id}:summary`}
                  onClick={() => void handleDownloadSummary(topic)}
                >
                  <BookOpen size={16} />
                </IconButton>
                <IconButton
                  label={t('subjects.downloadPracticeSheet')}
                  busy={downloadingKey === `${topic.id}:practice`}
                  onClick={() => void handleDownloadPracticeSheet(topic)}
                >
                  <Download size={16} />
                </IconButton>
                <ProgressRing value={topic.masteryScore} size={44} strokeWidth={5} />
              </Card>
            </Stagger>
          ))}
        </div>
      ) : (
        <SkeletonList className="mt-4" count={5} label={t('common.loadingTopics')} />
      )}
    </div>
  )
}

function IconButton({
  label,
  busy,
  onClick,
  children,
}: {
  label: string
  busy: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-busy={busy}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-400 transition-colors hover:bg-volt-50 hover:text-volt-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300 disabled:opacity-50"
    >
      {busy ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-volt-600"
        />
      ) : (
        children
      )}
    </button>
  )
}
