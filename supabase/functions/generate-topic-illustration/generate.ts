// The part of illustration generation that is identical whoever asked for it.
//
// Two entry points use this: the admin-triggered single generate
// (`generate-topic-illustration`, authenticated by the calling admin's JWT)
// and the server-side batch job (`generate-topic-illustrations-batch`,
// authenticated by CRON_SECRET). They differ only in who is allowed to ask
// and how many topics they ask for. Everything after that -- the prompt, the
// retry policy, the storage path, the pending media row -- must stay
// identical, which is why it lives here rather than being copied.
import { buildIllustrationPrompt } from './prompt.ts'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

export interface TopicRow {
  id: string
  name: string
  subject_id: string
  grade_id: string
}

export type GenerateOutcome =
  // deno-lint-ignore no-explicit-any
  | { ok: true; media: any; usedModel: string }
  | { ok: false; error: 'rate_limited' | 'image_generation_failed' | 'storage_upload_failed' | 'media_insert_failed'; detail: string }

// gpt-image-1 is current; dall-e-3 is the fallback for accounts without
// access to it. Each carries its own quality vocabulary, which is not
// interchangeable between them.
const MODELS: { model: string; quality: string }[] = [
  { model: 'gpt-image-1', quality: 'medium' },
  { model: 'dall-e-3', quality: 'standard' },
]

const MAX_ATTEMPTS = 4
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = Number(retryAfterHeader)
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 30_000)
  // Jitter so parallel workers do not all wake at the same instant and
  // immediately re-trip the per-minute limit.
  return Math.min(2 ** attempt * 1000, 16_000) + Math.random() * 500
}

/**
 * Generates one illustration for one topic and records it as a pending media
 * row. Never publishes: `approval_status` is always 'pending', and the
 * media_read RLS policy is what keeps a pending image away from learners.
 */
export async function generateAndStore(
  supabase: SupabaseClient,
  openaiKey: string,
  topic: TopicRow,
  opts: { sceneHint?: string } = {},
): Promise<GenerateOutcome> {
  const [{ data: subject }, { data: grade }] = await Promise.all([
    supabase.from('subjects').select('name').eq('id', topic.subject_id).maybeSingle(),
    supabase.from('grades').select('grade_number').eq('id', topic.grade_id).maybeSingle(),
  ])

  const prompt = buildIllustrationPrompt({
    topicName: topic.name,
    subjectName: subject?.name ?? '',
    gradeNumber: grade?.grade_number ?? 5,
    sceneHint: opts.sceneHint,
  })

  let imageBytes: Uint8Array | null = null
  let usedModel = ''
  let lastError = ''
  let rateLimited = false

  for (const { model, quality } of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality }),
        })

        if (!response.ok) {
          lastError = `${model}: ${response.status} ${await response.text()}`
          console.error(`OpenAI image generation failed: ${lastError}`)
          // 429 is "too fast", 5xx is "try again". Anything else fails the
          // same way on a retry, so fall through to the next model.
          const worthRetrying = response.status === 429 || response.status >= 500
          if (worthRetrying && attempt < MAX_ATTEMPTS) {
            if (response.status === 429) rateLimited = true
            await sleep(backoffMs(attempt, response.headers.get('retry-after')))
            continue
          }
          break
        }

        const result = await response.json()
        const b64 = result?.data?.[0]?.b64_json
        const url = result?.data?.[0]?.url

        if (b64) {
          imageBytes = Uint8Array.from(atob(b64), (c: string) => c.charCodeAt(0))
        } else if (url) {
          // The URL expires quickly, so it is downloaded now rather than stored.
          const download = await fetch(url)
          if (!download.ok) {
            lastError = `${model}: could not download generated image (${download.status})`
            console.error(lastError)
            continue
          }
          imageBytes = new Uint8Array(await download.arrayBuffer())
        } else {
          lastError = `${model}: response contained neither b64_json nor url`
          console.error(lastError)
          continue
        }

        usedModel = model
        break
      } catch (err) {
        lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`
        console.error(`OpenAI image generation threw: ${lastError}`)
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt, null))
          continue
        }
      }
    }
    if (imageBytes) break
  }

  if (!imageBytes) {
    return {
      ok: false,
      error: rateLimited ? 'rate_limited' : 'image_generation_failed',
      detail: lastError.slice(0, 400),
    }
  }

  const path = `${topic.id}/${Date.now()}.png`
  const { error: uploadError } = await supabase.storage
    .from('topic-illustrations')
    .upload(path, imageBytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error(`Storage upload failed: ${uploadError.message}`)
    return { ok: false, error: 'storage_upload_failed', detail: uploadError.message }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('topic-illustrations').getPublicUrl(path)

  const { data: mediaRow, error: mediaError } = await supabase
    .from('media')
    .insert({
      topic_id: topic.id,
      media_type: 'image',
      provider: 'openai',
      url: publicUrl,
      approval_status: 'pending',
      source: `ai_generated:${usedModel}`,
      language: 'en',
      // Stored with the image so a reviewer rejecting one can see what
      // produced it, and so a later prompt change is traceable.
      generation_prompt: prompt,
    })
    .select()
    .single()
  if (mediaError) {
    console.error(`media insert failed: ${mediaError.message}`)
    return { ok: false, error: 'media_insert_failed', detail: mediaError.message }
  }

  return { ok: true, media: mediaRow, usedModel }
}
