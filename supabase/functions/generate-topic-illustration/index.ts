// Supabase Edge Function: generate-topic-illustration
//
// Admin-triggered: generates one illustrative image per topic using an image
// AI provider (OpenAI, gpt-image-1 with a dall-e-3 fallback), stores it in the
// public `topic-illustrations`
// bucket, and logs it as a `media` row with approval_status='pending' -- the
// existing media_read RLS policy already ensures no learner ever sees it
// until an admin approves it (see migration 0005, media table).
//
// Deliberately scoped to *illustrative* images only -- a friendly scene
// setting the topic, nothing more:
//   - The prompt explicitly forbids any text, letters, or numbers in the
//     image. Current image-generation models are unreliable at rendering
//     legible text, and a curriculum product cannot risk a child seeing a
//     garbled or wrong label and treating it as real content. Anything that
//     needs accurate text (a labelled diagram, a flowchart) must be built as
//     a real UI component instead, never as an AI-generated picture.
//   - Runs only from the admin curriculum tools, authenticated with the
//     calling admin's own JWT (checked against the `admins` table before
//     anything else happens) -- never a service-role client, and never
//     reachable by a learner's session.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildIllustrationPrompt } from './prompt.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const body = await req.json().catch(() => null)
  const topicId = body?.topicId
  if (typeof topicId !== 'string') return jsonResponse({ error: 'missing_topic_id' }, 400)
  // Advisory only: buildIllustrationPrompt appends the hard constraints after
  // it, so a hint cannot switch off "no text" or "no realistic faces".
  const sceneHint = typeof body?.sceneHint === 'string' ? body.sceneHint : undefined

  // Scoped to the caller's own JWT throughout -- this function never uses a
  // service-role client. The admin check below is the real gate; RLS on
  // `admins`, `topics`, and `media` provides defense in depth underneath it.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const { data: adminRow } = await supabase
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()
  if (!adminRow) return jsonResponse({ error: 'admin_only' }, 403)

  // Deliberately after the admin gate. When this sat before it, an
  // unauthenticated caller holding only the public anon key could tell
  // whether the project has an image provider configured, just by reading
  // 503 vs 401. That is a small thing to leak, and free to not leak.
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  const { data: topic } = await supabase
    .from('topics')
    .select('name, subject_id, grade_id')
    .eq('id', topicId)
    .maybeSingle()
  if (!topic) return jsonResponse({ error: 'topic_not_found' }, 404)

  const [{ data: subject }, { data: grade }] = await Promise.all([
    supabase.from('subjects').select('name').eq('id', topic.subject_id).maybeSingle(),
    supabase.from('grades').select('grade_number').eq('id', topic.grade_id).maybeSingle(),
  ])

  const gradeNumber = grade?.grade_number ?? 5
  const subjectName = subject?.name ?? ''

  // Topic-specific rather than one generic template: the prompt builder maps
  // subject family and topic wording onto a concrete scene, so "The water
  // cycle" and "Trade" no longer produce interchangeable generic classroom
  // pictures. See prompt.ts.
  const prompt = buildIllustrationPrompt({
    topicName: topic.name,
    subjectName,
    gradeNumber,
    sceneHint,
  })

  // OpenAI removed `response_format` from the images endpoint; sending it now
  // fails the whole request with 400 "Unknown parameter". Two consequences
  // handled here:
  //   - the parameter is gone, and
  //   - without it the response may come back as either inline base64
  //     (`b64_json`, what gpt-image-1 returns) or a short-lived download URL
  //     (`url`, what dall-e-3 returns), so both shapes are accepted.
  //
  // Models are tried in order. gpt-image-1 is current; dall-e-3 is the
  // fallback for accounts that do not have access to it. Each carries its own
  // quality vocabulary, which is not interchangeable between them.
  const MODELS: { model: string; quality: string }[] = [
    { model: 'gpt-image-1', quality: 'medium' },
    { model: 'dall-e-3', quality: 'standard' },
  ]

  let imageBytes: Uint8Array | null = null
  let usedModel = ''
  let lastError = ''
  let rateLimited = false

  // Image generation is rate limited per minute, and a batch run drives this
  // function ~200 times in a row. Without this, the first burst succeeds and
  // the rest of the run comes back as a wall of 429s that look like real
  // failures. Retries are bounded and honour Retry-After when the provider
  // sends one.
  const MAX_ATTEMPTS = 4
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  function backoffMs(attempt: number, retryAfterHeader: string | null): number {
    const retryAfter = Number(retryAfterHeader)
    if (Number.isFinite(retryAfter) && retryAfter > 0)
      return Math.min(retryAfter * 1000, 30_000)
    // 2s, 4s, 8s, plus jitter so a batch's parallel workers do not all wake
    // up at the same instant and immediately re-trip the limit.
    return Math.min(2 ** attempt * 1000, 16_000) + Math.random() * 500
  }

  for (const { model, quality } of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024', quality }),
        })

        if (!response.ok) {
          const body = await response.text()
          lastError = `${model}: ${response.status} ${body}`
          console.error(`OpenAI image generation failed: ${lastError}`)

          // 429 is "too fast", 5xx is "try again". Both are worth another go.
          // Anything else -- a bad request, a model this account cannot use --
          // will fail identically on a retry, so fall through to the next model.
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
          imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
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
    // Pass the provider's own message back so the admin UI can show what
    // actually went wrong instead of a bare "failed", and separate "you are
    // going too fast" from "this will never work" so a batch run can retry
    // the first and give up on the second.
    return jsonResponse(
      {
        error: rateLimited ? 'rate_limited' : 'image_generation_failed',
        detail: lastError.slice(0, 400),
      },
      rateLimited ? 429 : 502,
    )
  }

  const path = `${topicId}/${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('topic-illustrations')
    .upload(path, imageBytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error(`Storage upload failed: ${uploadError.message}`)
    return jsonResponse({ error: 'storage_upload_failed' }, 500)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('topic-illustrations').getPublicUrl(path)

  const { data: mediaRow, error: mediaError } = await supabase
    .from('media')
    .insert({
      topic_id: topicId,
      media_type: 'image',
      provider: 'openai',
      url: publicUrl,
      approval_status: 'pending',
      source: `ai_generated:${usedModel}`,
      language: 'en',
      // The prompt is stored with the image so a reviewer who rejects one can
      // see what produced it, and so a later prompt change is traceable.
      generation_prompt: prompt,
    })
    .select()
    .single()
  if (mediaError) {
    console.error(`media insert failed: ${mediaError.message}`)
    return jsonResponse({ error: 'media_insert_failed' }, 500)
  }

  return jsonResponse({ media: mediaRow })
})
