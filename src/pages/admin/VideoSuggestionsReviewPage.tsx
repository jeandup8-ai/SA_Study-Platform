import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  fetchUnverifiedTopicVideos,
  verifyTopicVideo,
  rejectTopicVideo,
  type TopicVideoReviewItem,
} from '@/lib/admin/topicVideos'

/**
 * Video suggestion review queue. Every candidate sits here unverified until a
 * human watches it and approves -- nothing reaches a learner while
 * `verified = false` (see lib/curriculum/topicVideos.ts).
 *
 * Built for throughput, because watching is the slow part: one video in focus
 * at a time, keyboard approve/reject, auto-advance to the next. Sourcing notes
 * that ask for extra scrutiny (sensitive subject matter, uncertain grade fit,
 * weak topic match) are detected and shown as a banner rather than buried in
 * body text, so the reviewer knows which ones need a full watch-through versus
 * a quick confidence check.
 */

// Phrases the sourcing notes use when a candidate needs more than a quick look.
const ATTENTION_PHRASES = [
  'review with care',
  'review with extra care',
  'review for content',
  'weakest match',
  'weak match',
  'compromise pick',
  'please review',
]

function needsAttention(item: TopicVideoReviewItem): boolean {
  const notes = item.notes?.toLowerCase() ?? ''
  return ATTENTION_PHRASES.some((phrase) => notes.includes(phrase))
}

export function VideoSuggestionsReviewPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<TopicVideoReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [focusIndex, setFocusIndex] = useState(0)
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)

  async function load() {
    setLoading(true)
    const rows = await fetchUnverifiedTopicVideos()
    // Group by subject then grade so the reviewer stays in one mental context
    // instead of jumping between Maths and history every click.
    rows.sort(
      (a, b) =>
        (a.subject_name ?? '').localeCompare(b.subject_name ?? '') ||
        (a.grade_number ?? 0) - (b.grade_number ?? 0) ||
        (a.topic_name ?? '').localeCompare(b.topic_name ?? ''),
    )
    setItems(rows)
    setFocusIndex(0)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const subjects = useMemo(
    () =>
      [
        ...new Set(
          items.map((i) => i.subject_name).filter((s): s is string => Boolean(s)),
        ),
      ].sort(),
    [items],
  )

  const visible = useMemo(
    () =>
      subjectFilter === 'all'
        ? items
        : items.filter((i) => i.subject_name === subjectFilter),
    [items, subjectFilter],
  )

  const current = visible[focusIndex] ?? null
  const attentionCount = useMemo(() => visible.filter(needsAttention).length, [visible])

  /** Removes the decided row locally and keeps focus on the same slot, which
   * now holds the next item -- so a run of approvals never needs a click to
   * advance, and the list never re-fetches mid-review. */
  const decide = useCallback(
    async (item: TopicVideoReviewItem, approve: boolean) => {
      if (busy || !session) return
      setBusy(true)
      try {
        if (approve) await verifyTopicVideo(item.id, session.user.id)
        else await rejectTopicVideo(item.id)
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        setReviewedCount((n) => n + 1)
        setFocusIndex((i) => Math.max(0, Math.min(i, visible.length - 2)))
      } finally {
        setBusy(false)
      }
    },
    [busy, session, visible.length],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return
      if (!current) return
      if (e.key === 'a' || e.key === 'A') void decide(current, true)
      else if (e.key === 'r' || e.key === 'R') void decide(current, false)
      else if (e.key === 'j' || e.key === 'ArrowDown')
        setFocusIndex((i) => Math.min(i + 1, visible.length - 1))
      else if (e.key === 'k' || e.key === 'ArrowUp')
        setFocusIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, decide, visible.length])

  if (loading) return <p className="text-ink-400">Loading...</p>

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
            Video suggestions review queue
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-300">
            Candidate YouTube videos, sourced externally — never our own content. Watch
            before approving: check it is accurate, age-appropriate, and clearly audible.
            Nothing here reaches a learner until approved.
          </p>
        </div>
        <div className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2 text-right">
          <p className="text-2xl font-extrabold text-white">{visible.length}</p>
          <p className="text-xs text-ink-300">awaiting review</p>
          {reviewedCount > 0 && (
            <p className="mt-1 text-xs text-success-600">
              {reviewedCount} done this session
            </p>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <p className="mt-6 text-ink-400">Nothing waiting for review right now.</p>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FilterChip
              active={subjectFilter === 'all'}
              onClick={() => {
                setSubjectFilter('all')
                setFocusIndex(0)
              }}
            >
              All ({items.length})
            </FilterChip>
            {subjects.map((s) => (
              <FilterChip
                key={s}
                active={subjectFilter === s}
                onClick={() => {
                  setSubjectFilter(s)
                  setFocusIndex(0)
                }}
              >
                {s} ({items.filter((i) => i.subject_name === s).length})
              </FilterChip>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-400">
            Keyboard: <Kbd>A</Kbd> approve · <Kbd>R</Kbd> reject · <Kbd>J</Kbd>/
            <Kbd>K</Kbd> move. Deciding auto-advances.
            {attentionCount > 0 && (
              <span className="ml-2 text-amber-300">
                {attentionCount} in this view flagged for closer attention.
              </span>
            )}
          </p>

          {current && (
            <div className="mt-4 rounded-2xl border-2 border-brand-500 bg-ink-800 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-white">{current.title}</p>
                  <p className="text-sm text-ink-300">
                    {current.channel_name} · {current.language.toUpperCase()}
                    {current.subject_name ? ` · ${current.subject_name}` : ''}
                    {current.grade_number ? ` · Grade ${current.grade_number}` : ''}
                  </p>
                  <p className="text-sm text-ink-400">{current.topic_name}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void decide(current, true)}
                    disabled={busy}
                    className="rounded-lg bg-success-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Approve (A)
                  </button>
                  <button
                    onClick={() => void decide(current, false)}
                    disabled={busy}
                    className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Reject (R)
                  </button>
                </div>
              </div>

              {needsAttention(current) && (
                <p className="mt-3 rounded-lg border border-amber-700 bg-amber-950/60 px-3 py-2 text-sm font-semibold text-amber-200">
                  Flagged when sourced — watch this one in full before deciding.
                </p>
              )}

              <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  key={current.id}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${current.youtube_video_id}`}
                  title={current.title}
                  allow="encrypted-media"
                  allowFullScreen
                />
              </div>

              {current.notes && (
                <p className="mt-3 text-sm text-ink-200">{current.notes}</p>
              )}

              <a
                href={`https://www.youtube.com/watch?v=${current.youtube_video_id}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-3 inline-block text-xs text-ink-300 underline hover:text-ink-100"
              >
                Open on YouTube (for scrubbing / playback speed)
              </a>
            </div>
          )}

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-ink-400">
            Queue
          </h2>
          <div className="mt-2 space-y-1">
            {visible.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setFocusIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === focusIndex
                    ? 'bg-ink-700 text-white'
                    : 'text-ink-300 hover:bg-ink-800'
                }`}
              >
                <span className="w-16 shrink-0 text-xs text-ink-400">
                  {item.subject_name?.slice(0, 8)}{' '}
                  {item.grade_number ? `G${item.grade_number}` : ''}
                </span>
                <span className="shrink-0 rounded bg-ink-700 px-1.5 text-xs uppercase">
                  {item.language}
                </span>
                {needsAttention(item) && (
                  <span className="shrink-0 text-amber-400">⚠</span>
                )}
                <span className="truncate">{item.topic_name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
        active ? 'bg-brand-600 text-white' : 'bg-ink-700 text-ink-200 hover:bg-ink-600'
      }`}
    >
      {children}
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink-600 bg-ink-700 px-1.5 font-mono text-xs text-ink-200">
      {children}
    </kbd>
  )
}
