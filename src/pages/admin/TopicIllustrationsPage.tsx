import { useEffect, useState } from 'react'
import {
  fetchPendingIllustrations,
  fetchTopicIllustrationStatuses,
  generateTopicIllustration,
  approveIllustration,
  rejectIllustration,
  type PendingIllustration,
  type TopicIllustrationStatus,
} from '@/lib/admin/illustrations'

const STATUS_LABEL: Record<TopicIllustrationStatus['status'], string> = {
  none: 'No illustration yet',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function TopicIllustrationsPage() {
  const [pending, setPending] = useState<PendingIllustration[]>([])
  const [topics, setTopics] = useState<TopicIllustrationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [pendingRows, topicRows] = await Promise.all([fetchPendingIllustrations(), fetchTopicIllustrationStatuses()])
    setPending(pendingRows)
    setTopics(topicRows)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleGenerate(topicId: string) {
    setGeneratingId(topicId)
    setGenerateError(null)
    const result = await generateTopicIllustration(topicId)
    if (!result.ok) setGenerateError(`Topic ${topicId}: ${result.error}`)
    setGeneratingId(null)
    await load()
  }

  async function handleApprove(mediaId: string) {
    await approveIllustration(mediaId)
    await load()
  }

  async function handleReject(mediaId: string) {
    await rejectIllustration(mediaId)
    await load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Topic illustrations</h1>
      <p className="mt-1 text-sm text-slate-400">
        AI-generated illustrative images (OpenAI DALL-E 3) — a friendly scene per topic, never text or labels. Every
        image lands here pending review before any learner can see it.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}

      {!loading && (
        <>
          <h2 className="mt-8 text-lg font-bold text-white">Pending review ({pending.length})</h2>
          {pending.length === 0 && <p className="mt-2 text-sm text-slate-500">Nothing waiting for review.</p>}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                {item.url && <img src={item.url} alt={item.topic_name} className="aspect-square w-full rounded-xl object-cover" />}
                <p className="mt-2 font-bold text-white">{item.topic_name}</p>
                <p className="text-xs text-slate-400">
                  Grade {item.grade_number} · {item.subject_name}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => void handleApprove(item.id)}
                    className="flex-1 rounded-lg bg-success-600 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void handleReject(item.id)}
                    className="flex-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {generateError && <p className="mt-6 text-sm font-medium text-danger-500">{generateError}</p>}

          <h2 className="mt-8 text-lg font-bold text-white">All topics ({topics.length})</h2>
          <div className="mt-3 space-y-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-white">{topic.name}</p>
                  <p className="text-xs text-slate-400">
                    Grade {topic.grade_number} · {topic.subject_name} · {STATUS_LABEL[topic.status]}
                  </p>
                </div>
                <button
                  onClick={() => void handleGenerate(topic.id)}
                  disabled={generatingId === topic.id}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {generatingId === topic.id
                    ? 'Generating...'
                    : topic.status === 'none'
                      ? 'Generate'
                      : 'Regenerate'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
