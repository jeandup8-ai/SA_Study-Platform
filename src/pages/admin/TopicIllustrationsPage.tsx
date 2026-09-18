import { useMemo, useRef, useState } from 'react'
import {
  Check,
  X,
  Loader2,
  ImageOff,
  Search,
  Wand2,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react'
import {
  fetchTopicIllustrationStatuses,
  generateTopicIllustration,
  generateIllustrationsBatch,
  approveIllustration,
  rejectIllustration,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY,
  type TopicIllustrationStatus,
  type BatchProgress,
} from '@/lib/admin/illustrations'
import { useAsync } from '@/hooks/useAsync'

type StatusKey = TopicIllustrationStatus['status']

const STATUS_LABEL: Record<StatusKey, string> = {
  none: 'Not generated',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STATUS_CHIP: Record<StatusKey, string> = {
  none: 'bg-ink-700 text-ink-200',
  pending: 'bg-gold-500/20 text-gold-300',
  approved: 'bg-success-500/20 text-success-500',
  rejected: 'bg-danger-500/20 text-danger-500',
}

// gpt-image-1 medium / DALL-E 3 standard at 1024x1024. An estimate for the
// confirmation prompt only -- nothing is billed or metered in-app.
const ESTIMATED_COST_PER_IMAGE_USD = 0.04

export function TopicIllustrationsPage() {
  const { status, data, reload } = useAsync<TopicIllustrationStatus[]>(
    () => fetchTopicIllustrationStatuses(),
    [],
  )

  const [query, setQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all')

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())
  const [errorByTopic, setErrorByTopic] = useState<Record<string, string>>({})
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY)
  const [batch, setBatch] = useState<BatchProgress | null>(null)
  const [batchSummary, setBatchSummary] = useState<{ succeeded: number; failed: number } | null>(
    null,
  )
  const batchContinueRef = useRef(true)

  const topics = useMemo(() => data ?? [], [data])

  const grades = useMemo(
    () => [...new Set(topics.map((t) => t.grade_number))].sort((a, b) => a - b),
    [topics],
  )
  const subjects = useMemo(
    () => [...new Set(topics.map((t) => t.subject_name))].sort(),
    [topics],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return topics.filter((t) => {
      if (gradeFilter !== 'all' && t.grade_number !== gradeFilter) return false
      if (subjectFilter !== 'all' && t.subject_name !== subjectFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (needle && !t.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [topics, query, gradeFilter, subjectFilter, statusFilter])

  const counts = useMemo(() => {
    const base: Record<StatusKey, number> = { none: 0, pending: 0, approved: 0, rejected: 0 }
    for (const t of topics) base[t.status]++
    return base
  }, [topics])

  const batchRunning = batch !== null

  function clearError(topicId: string) {
    setErrorByTopic((prev) => {
      if (!(topicId in prev)) return prev
      const next = { ...prev }
      delete next[topicId]
      return next
    })
  }

  async function handleGenerate(topicId: string) {
    setGeneratingIds((prev) => new Set(prev).add(topicId))
    clearError(topicId)
    const result = await generateTopicIllustration(topicId)
    if (!result.ok) setErrorByTopic((prev) => ({ ...prev, [topicId]: result.error ?? 'unknown' }))
    setGeneratingIds((prev) => {
      const next = new Set(prev)
      next.delete(topicId)
      return next
    })
    reload()
  }

  async function handleReview(mediaId: string, decision: 'approve' | 'reject') {
    if (decision === 'approve') await approveIllustration(mediaId)
    else await rejectIllustration(mediaId)
    reload()
  }

  /** Runs the batch over exactly what the filters are currently showing. */
  async function handleGenerateFiltered() {
    const targets = filtered.filter((t) => t.status === 'none' || t.status === 'rejected')
    if (targets.length === 0) return

    const estimate = (targets.length * ESTIMATED_COST_PER_IMAGE_USD).toFixed(2)
    const confirmed = window.confirm(
      `Generate illustrations for ${targets.length} topic${targets.length === 1 ? '' : 's'}?\n\n` +
        `This calls a paid OpenAI image-generation API once per topic — roughly $${estimate} in total ` +
        `at current pricing — running ${concurrency} at a time.\n\n` +
        `Every image lands as "Pending review" for you to approve or reject. Nothing reaches a learner ` +
        `automatically. You can stop partway through; anything already generated stays in the queue.`,
    )
    if (!confirmed) return

    batchContinueRef.current = true
    setBatchSummary(null)
    setErrorByTopic({})
    setBatch({ done: 0, total: targets.length, inFlight: 0, succeeded: 0, failed: 0 })

    const { succeeded, failed } = await generateIllustrationsBatch(
      targets.map((t) => t.id),
      {
        concurrency,
        shouldContinue: () => batchContinueRef.current,
        onProgress: setBatch,
        // Each failure is attached to its own row as it happens, so a long
        // run stays diagnosable while it is still going rather than only
        // reporting a count at the end.
        onResult: (topicId, result) => {
          if (!result.ok) {
            setErrorByTopic((prev) => ({ ...prev, [topicId]: result.error ?? 'unknown' }))
          }
        },
      },
    )

    setBatchSummary({ succeeded, failed: failed.length })
    setBatch(null)
    reload()
  }

  const batchTargets = filtered.filter((t) => t.status === 'none' || t.status === 'rejected').length

  return (
    <div>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-volt-400">Admin</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-white">
          Illustration Studio
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-300">
          One AI-generated scene per topic. The prompt is built per topic from its subject and name,
          and hard-forbids text, letters and numbers in the image — models still render those
          unreliably, and a wrong label read as fact is worse than no picture. Every image waits here
          for your approval before any learner can see it.
        </p>
      </header>

      {status === 'error' ? (
        <div className="mt-6 rounded-2xl border border-danger-500/40 bg-danger-500/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-danger-500">
            <AlertTriangle size={16} /> Could not load topics.
          </p>
          <button
            onClick={reload}
            className="mt-3 rounded-lg bg-ink-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-600"
          >
            Try again
          </button>
        </div>
      ) : status !== 'success' ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-2xl border border-ink-700 bg-ink-800 p-3">
              <div className="skeleton aspect-square w-full rounded-xl" />
              <div className="skeleton mt-3 h-4 w-2/3 rounded" />
              <div className="skeleton mt-2 h-3 w-1/3 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(STATUS_LABEL) as StatusKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setStatusFilter((prev) => (prev === key ? 'all' : key))}
                aria-pressed={statusFilter === key}
                className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                  statusFilter === key
                    ? 'border-volt-500 bg-volt-500/10'
                    : 'border-ink-700 bg-ink-800/60 hover:border-ink-600'
                }`}
              >
                <p className="font-display text-2xl font-extrabold text-white">{counts[key]}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-300">
                  {STATUS_LABEL[key]}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-700 bg-ink-800/60 p-3">
            <SlidersHorizontal size={16} className="text-ink-400" aria-hidden />
            <label className="relative flex-1 min-w-48">
              <span className="sr-only">Search topics</span>
              <Search
                size={15}
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics"
                className="w-full min-h-10 rounded-xl border border-ink-700 bg-ink-900 pl-9 pr-3 text-sm text-white placeholder:text-ink-400 focus:border-volt-500 focus:outline-none"
              />
            </label>
            <FilterSelect
              label="Grade"
              value={gradeFilter === 'all' ? 'all' : String(gradeFilter)}
              onChange={(v) => setGradeFilter(v === 'all' ? 'all' : Number(v))}
              options={[
                { value: 'all', label: 'All grades' },
                ...grades.map((g) => ({ value: String(g), label: `Grade ${g}` })),
              ]}
            />
            <FilterSelect
              label="Subject"
              value={subjectFilter}
              onChange={setSubjectFilter}
              options={[
                { value: 'all', label: 'All subjects' },
                ...subjects.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-ink-700 bg-ink-800/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-white">
                  Batch generate — {batchTargets} topic{batchTargets === 1 ? '' : 's'} in the current
                  filter
                </p>
                <p className="mt-0.5 text-sm text-ink-300">
                  Covers topics with no illustration and ones previously rejected. Estimated{' '}
                  ${(batchTargets * ESTIMATED_COST_PER_IMAGE_USD).toFixed(2)} at $
                  {ESTIMATED_COST_PER_IMAGE_USD.toFixed(2)} an image.
                </p>
              </div>
              {!batchRunning ? (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink-300">
                    At once
                    <select
                      value={concurrency}
                      onChange={(e) => setConcurrency(Number(e.target.value))}
                      className="min-h-10 rounded-xl border border-ink-700 bg-ink-900 px-2 text-sm text-white focus:border-volt-500 focus:outline-none"
                    >
                      {Array.from({ length: MAX_CONCURRENCY }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => void handleGenerateFiltered()}
                    disabled={batchTargets === 0}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-volt-500 px-4 text-sm font-bold text-ink-950 hover:bg-volt-400 disabled:opacity-40"
                  >
                    <Wand2 size={15} aria-hidden />
                    Generate
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    batchContinueRef.current = false
                  }}
                  className="min-h-10 rounded-xl bg-ink-700 px-4 text-sm font-semibold text-white hover:bg-ink-600"
                >
                  Stop after in-flight
                </button>
              )}
            </div>

            {batch && (
              <div className="mt-3" role="status" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-ink-900">
                  <div
                    className="h-full rounded-full bg-volt-500 transition-all"
                    style={{ width: `${batch.total ? (batch.done / batch.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-ink-300">
                  {batch.done} of {batch.total} done · {batch.inFlight} in flight ·{' '}
                  {batch.succeeded} generated · {batch.failed} failed
                </p>
              </div>
            )}

            {batchSummary && !batch && (
              <p className="mt-3 text-sm text-ink-200">
                Finished: {batchSummary.succeeded} generated
                {batchSummary.failed > 0
                  ? `, ${batchSummary.failed} failed — the reason is shown on each topic below.`
                  : '.'}
              </p>
            )}
          </div>

          <p className="mt-6 text-sm text-ink-400">
            Showing {filtered.length} of {topics.length} topics
          </p>

          {filtered.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
              <ImageOff size={24} className="mx-auto text-ink-500" aria-hidden />
              <p className="mt-2 font-semibold text-ink-200">No topics match these filters.</p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  busy={generatingIds.has(topic.id)}
                  disabled={batchRunning}
                  error={errorByTopic[topic.id]}
                  onGenerate={() => void handleGenerate(topic.id)}
                  onReview={(decision) => void handleReview(topic.mediaId!, decision)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-300">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 max-w-44 rounded-xl border border-ink-700 bg-ink-900 px-2 text-sm text-white focus:border-volt-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function TopicCard({
  topic,
  busy,
  disabled,
  error,
  onGenerate,
  onReview,
}: {
  topic: TopicIllustrationStatus
  busy: boolean
  disabled: boolean
  error?: string
  onGenerate: () => void
  onReview: (decision: 'approve' | 'reject') => void
}) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-800">
      <div className="relative aspect-square w-full bg-ink-900">
        {topic.imageUrl ? (
          <img
            src={topic.imageUrl}
            // Decorative within the studio -- the topic name is already the
            // card's heading right below, so repeating it here would make a
            // screen reader announce it twice.
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-600">
            <ImageOff size={28} aria-hidden />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
            <Loader2 size={26} className="animate-spin text-volt-400" aria-hidden />
            <span className="sr-only">Generating</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-display font-bold text-white break-words">{topic.name}</h3>
        <p className="mt-0.5 text-xs text-ink-400">
          Grade {topic.grade_number} · {topic.subject_name}
        </p>
        <span
          className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CHIP[topic.status]}`}
        >
          {STATUS_LABEL[topic.status]}
        </span>

        {error && (
          <p className="mt-2 break-words rounded-lg bg-danger-500/15 px-3 py-2 text-xs font-medium text-danger-500">
            {error}
          </p>
        )}

        {topic.generationPrompt && (
          <div className="mt-2">
            <button
              onClick={() => setPromptOpen((v) => !v)}
              aria-expanded={promptOpen}
              className="text-xs font-semibold text-volt-400 hover:text-volt-300"
            >
              {promptOpen ? 'Hide prompt' : 'Show prompt'}
            </button>
            {promptOpen && (
              <p className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-ink-900 p-2 text-xs leading-relaxed text-ink-300">
                {topic.generationPrompt}
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 pt-1">
          {topic.status === 'pending' && topic.mediaId && (
            <>
              <button
                onClick={() => onReview('approve')}
                disabled={disabled}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-success-600 px-3 text-sm font-semibold text-white hover:bg-success-500 disabled:opacity-40"
              >
                <Check size={15} aria-hidden /> Approve
              </button>
              <button
                onClick={() => onReview('reject')}
                disabled={disabled}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-700 px-3 text-sm font-semibold text-white hover:bg-ink-600 disabled:opacity-40"
              >
                <X size={15} aria-hidden /> Reject
              </button>
            </>
          )}
          <button
            onClick={onGenerate}
            disabled={busy || disabled}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-ink-600 px-3 text-sm font-semibold text-ink-100 hover:bg-white/5 disabled:opacity-40"
          >
            <Wand2 size={15} aria-hidden />
            {busy ? 'Generating…' : topic.status === 'none' ? 'Generate' : 'Regenerate'}
          </button>
        </div>
      </div>
    </article>
  )
}
