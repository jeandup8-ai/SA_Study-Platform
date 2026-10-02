import { supabase } from '@/lib/supabase'

/**
 * Admin-side data layer for the Illustration Studio.
 *
 * Every generated image is written by the edge function as
 * approval_status='pending'. The `media_read` RLS policy is what actually
 * keeps a pending image away from learners; nothing here can bypass it.
 */

export async function approveIllustration(mediaId: string) {
  const { error } = await supabase
    .from('media')
    .update({ approval_status: 'approved' })
    .eq('id', mediaId)
  if (error) throw error
}

export async function rejectIllustration(mediaId: string) {
  const { error } = await supabase
    .from('media')
    .update({ approval_status: 'rejected' })
    .eq('id', mediaId)
  if (error) throw error
}

export interface TopicIllustrationStatus {
  id: string
  name: string
  subject_name: string
  grade_number: number
  status: 'none' | 'pending' | 'approved' | 'rejected'
  /** The most recent image for this topic, if any -- shown as the thumbnail. */
  mediaId: string | null
  imageUrl: string | null
  /** The prompt that produced the current image, when it was AI-generated. */
  generationPrompt: string | null
  /** Where the current image came from: the generator, or a human upload. */
  provider: string | null
  source: string | null
  /**
   * The newest *approved* image -- what a learner actually sees right now.
   *
   * Distinct from the fields above, which describe the newest row of any
   * status. Uploading a replacement for a topic that already has approved
   * artwork creates a newer pending row, and without this the card would
   * read "Pending review", show the candidate, and give no hint that an
   * approved image is still live in lessons. The learner-facing queries
   * order by created_at among approved rows only
   * (src/lib/curriculum/topics.ts), so the old image keeps serving until
   * the new one is approved -- which is correct, and worth being able to
   * see.
   */
  approvedMediaId: string | null
  approvedUrl: string | null
  /**
   * How many rows for this topic are awaiting review. More than one means
   * earlier candidates exist that a single-thumbnail card cannot show.
   */
  pendingCount: number
  /** Every pending row, newest first. Used by the replacement flow. */
  pending: { mediaId: string; url: string | null; createdAt: string }[]
}

/** Every real (non-demo) topic with its current illustration state. */
export async function fetchTopicIllustrationStatuses(): Promise<
  TopicIllustrationStatus[]
> {
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, name, subject_id, grade_id')
    .eq('is_demo_content', false)
    .order('name', { ascending: true })
  if (topicsError) throw topicsError
  if (!topics || topics.length === 0) return []

  const subjectIds = [...new Set(topics.map((t) => t.subject_id))]
  const gradeIds = [...new Set(topics.map((t) => t.grade_id))]
  const topicIds = topics.map((t) => t.id)

  const [{ data: subjects }, { data: grades }, { data: mediaRows }] = await Promise.all([
    supabase.from('subjects').select('id, name').in('id', subjectIds),
    supabase.from('grades').select('id, grade_number').in('id', gradeIds),
    supabase
      .from('media')
      .select(
        'id, topic_id, approval_status, url, generation_prompt, provider, source, created_at',
      )
      .eq('media_type', 'image')
      .in('topic_id', topicIds)
      .order('created_at', { ascending: false }),
  ])

  const subjectById = new Map((subjects ?? []).map((s) => [s.id, s.name]))
  const gradeById = new Map((grades ?? []).map((g) => [g.id, g.grade_number]))
  // First row per topic (already sorted newest-first) is that topic's current image.
  type MediaSummary = NonNullable<typeof mediaRows>[number]
  const currentByTopic = new Map<string, MediaSummary>()
  // Tracked separately from `current` because the newest row and the live
  // one are not the same thing once a replacement is pending.
  const approvedByTopic = new Map<string, MediaSummary>()
  const pendingByTopic = new Map<string, MediaSummary[]>()
  for (const row of mediaRows ?? []) {
    if (!row.topic_id) continue
    if (!currentByTopic.has(row.topic_id)) currentByTopic.set(row.topic_id, row)
    if (row.approval_status === 'approved' && !approvedByTopic.has(row.topic_id)) {
      approvedByTopic.set(row.topic_id, row)
    }
    if (row.approval_status === 'pending') {
      const list = pendingByTopic.get(row.topic_id)
      if (list) list.push(row)
      else pendingByTopic.set(row.topic_id, [row])
    }
  }

  return topics.map((t) => {
    const current = currentByTopic.get(t.id)
    const approved = approvedByTopic.get(t.id)
    const pending = pendingByTopic.get(t.id) ?? []
    return {
      id: t.id,
      name: t.name,
      subject_name: subjectById.get(t.subject_id) ?? 'Unknown subject',
      grade_number: gradeById.get(t.grade_id) ?? 0,
      status: current?.approval_status ?? ('none' as const),
      mediaId: current?.id ?? null,
      imageUrl: current?.url ?? null,
      generationPrompt: current?.generation_prompt ?? null,
      provider: current?.provider ?? null,
      source: current?.source ?? null,
      approvedMediaId: approved?.id ?? null,
      approvedUrl: approved?.url ?? null,
      pendingCount: pending.length,
      pending: pending.map((p) => ({
        mediaId: p.id,
        url: p.url,
        createdAt: p.created_at,
      })),
    }
  })
}

export interface GenerateIllustrationResult {
  ok: boolean
  error?: string
  /** The provider asked us to slow down. Worth trying this topic again later
   * in the run rather than recording it as a failure. */
  rateLimited?: boolean
}

export async function generateTopicIllustration(
  topicId: string,
  sceneHint?: string,
): Promise<GenerateIllustrationResult> {
  const { data, error } = await supabase.functions.invoke('generate-topic-illustration', {
    body: sceneHint ? { topicId, sceneHint } : { topicId },
  })
  if (error) {
    const context = (
      error as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> }
      }
    ).context
    const respBody = await context?.json?.().catch(() => null)
    // `detail` carries the image provider's own message. Without it every
    // failure looked identical ("image_generation_failed"), which is what
    // hid a plain 400 from a removed API parameter for as long as it did.
    const code = respBody?.error ?? 'unknown'
    return {
      ok: false,
      rateLimited: code === 'rate_limited',
      error: respBody?.detail ? `${code}: ${respBody.detail}` : code,
    }
  }
  if (!data?.media) return { ok: false, error: 'unknown' }
  return { ok: true }
}

export interface BatchProgress {
  /** Calls that have finished, successfully or not. */
  done: number
  total: number
  /** Calls currently in flight. */
  inFlight: number
  succeeded: number
  failed: number
}

export interface BatchOptions {
  /**
   * How many generations run at once. Each one is a paid image-generation
   * call against a per-minute rate limit, so this is deliberately small and
   * deliberately the caller's choice rather than "as fast as possible".
   */
  concurrency?: number
  /** Milliseconds to wait after each completed call before starting the next. */
  delayMs?: number
  onProgress?: (progress: BatchProgress) => void
  onResult?: (topicId: string, result: GenerateIllustrationResult) => void
  /** Polled between calls; returning false stops starting new work. */
  shouldContinue?: () => boolean
}

export const DEFAULT_CONCURRENCY = 3
export const MAX_CONCURRENCY = 6

/**
 * Generates illustrations for a list of topics with a bounded worker pool.
 *
 * Previously this ran strictly one at a time, which meant ~200 topics took
 * as long as 200 sequential round trips to an image model. Running them all
 * at once is the other failure -- it bursts straight past the provider's
 * per-minute image rate limit and most of the batch comes back as errors.
 * A small fixed pool is the shape that fits: several in flight, never
 * unbounded, and cancellable between calls.
 *
 * Every generated image still lands as approval_status='pending', exactly
 * like a single manual "Generate" click. This changes how many times the
 * button is pressed, and nothing about the human review gate.
 */
export async function generateIllustrationsBatch(
  topicIds: string[],
  options: BatchOptions = {},
): Promise<{ succeeded: number; failed: { topicId: string; error: string }[] }> {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    delayMs = 250,
    onProgress,
    onResult,
    shouldContinue,
  } = options

  const workers = Math.max(1, Math.min(Math.trunc(concurrency), MAX_CONCURRENCY))
  // `topicIds` is appended to when a topic is rate limited, so the queue can
  // grow; `requeued` bounds that so a permanently throttled account ends the
  // run instead of looping forever.
  const queue = [...topicIds]
  // Reported as the denominator. `queue` grows when a topic is requeued, so
  // using its length would make the progress bar run backwards mid-run.
  const total = topicIds.length
  const requeued = new Map<string, number>()
  const MAX_REQUEUES = 3
  const RATE_LIMIT_PAUSE_MS = 20_000
  const failed: { topicId: string; error: string }[] = []
  let succeeded = 0
  let done = 0
  let inFlight = 0
  let cursor = 0

  const report = () =>
    onProgress?.({ done, total, inFlight, succeeded, failed: failed.length })

  async function runWorker() {
    for (;;) {
      if (shouldContinue && !shouldContinue()) return
      const index = cursor++
      if (index >= queue.length) return
      const topicId = queue[index]

      inFlight++
      report()
      const result = await generateTopicIllustration(topicId)
      inFlight--

      // A rate-limited topic is not a failure, it is a "not yet". The edge
      // function already retried it several times, so by the time it reaches
      // here the whole account is saturated: pause this worker, put the topic
      // back on the end of the queue, and carry on. Without this, a long run
      // against a low per-minute image quota reports most of the batch as
      // broken when nothing is actually wrong.
      if (result.rateLimited && (requeued.get(topicId) ?? 0) < MAX_REQUEUES) {
        requeued.set(topicId, (requeued.get(topicId) ?? 0) + 1)
        queue.push(topicId)
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS))
        report()
        continue
      }

      done++
      if (result.ok) succeeded++
      else failed.push({ topicId, error: result.error ?? 'unknown' })
      onResult?.(topicId, result)
      report()

      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  report()
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, runWorker))
  return { succeeded, failed }
}
