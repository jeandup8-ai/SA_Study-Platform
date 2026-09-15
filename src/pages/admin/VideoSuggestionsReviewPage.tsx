import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchUnverifiedTopicVideos,
  verifyTopicVideo,
  rejectTopicVideo,
  type TopicVideoReviewItem,
} from '@/lib/admin/topicVideos'

/**
 * Video suggestion review queue: every candidate YouTube video sits here as
 * unverified until a human reviewer actually watches it and confirms it's
 * accurate and age-appropriate. Nothing here is ever surfaced to a learner
 * while `verified = false` (see lib/curriculum/topicVideos.ts).
 */
export function VideoSuggestionsReviewPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<TopicVideoReviewItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setItems(await fetchUnverifiedTopicVideos())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function approve(id: string) {
    if (!session) return
    await verifyTopicVideo(id, session.user.id)
    await load()
  }

  async function reject(id: string) {
    await rejectTopicVideo(id)
    await load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Video suggestions review queue</h1>
      <p className="mt-1 text-sm text-slate-400">
        Candidate YouTube videos for each topic — sourced externally, never our own content. Watch the full video
        before approving: check it's accurate, age-appropriate, and free of distracting ads or clickbait. Nothing
        here reaches a learner until approved.
      </p>

      {loading && <p className="mt-6 text-slate-500">Loading...</p>}
      {!loading && items.length === 0 && (
        <p className="mt-6 text-slate-500">Nothing waiting for review right now.</p>
      )}

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-white">{item.title}</p>
                <p className="text-sm text-slate-400">
                  {item.channel_name}
                  {' · '}
                  {item.language.toUpperCase()}
                  {item.topic_name ? ` · ${item.topic_name}` : ''}
                  {item.subject_name ? ` · ${item.subject_name}` : ''}
                  {item.grade_number ? ` · Grade ${item.grade_number}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void approve(item.id)}
                  className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => void reject(item.id)}
                  className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Reject
                </button>
              </div>
            </div>

            <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${item.youtube_video_id}`}
                title={item.title}
                allow="encrypted-media"
                allowFullScreen
              />
            </div>

            {item.notes && <p className="mt-3 text-sm text-slate-300">{item.notes}</p>}

            <p className="mt-3 rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              Suggested by: {item.suggested_by}. Watch the entire video before approving — it becomes visible to
              learners as soon as it is marked approved.
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
