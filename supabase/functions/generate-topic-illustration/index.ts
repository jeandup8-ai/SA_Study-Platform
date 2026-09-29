// Supabase Edge Function: generate-topic-illustration
//
// Admin-triggered: generates one illustrative image for one topic using an
// image AI provider (OpenAI, gpt-image-1 with a dall-e-3 fallback), stores it
// in the public `topic-illustrations` bucket, and logs it as a `media` row
// with approval_status='pending' -- the existing media_read RLS policy already
// ensures no learner ever sees it until an admin approves it (see migration
// 0005, media table).
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
//
// The generation itself lives in ./generate.ts, shared with the server-side
// batch job, so the two cannot drift apart on prompt, retries, or approval
// state. This file is only the "who is allowed to ask" half.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateAndStore } from './generate.ts'

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
    .select('id, name, subject_id, grade_id')
    .eq('id', topicId)
    .maybeSingle()
  if (!topic) return jsonResponse({ error: 'topic_not_found' }, 404)

  const outcome = await generateAndStore(supabase, openaiKey, topic, { sceneHint })

  if (!outcome.ok) {
    // Pass the provider's own message back so the admin UI can show what
    // actually went wrong instead of a bare "failed", and separate "you are
    // going too fast" from "this will never work" so a batch run can retry
    // the first and give up on the second.
    const status =
      outcome.error === 'rate_limited' ? 429 : outcome.error === 'image_generation_failed' ? 502 : 500
    return jsonResponse({ error: outcome.error, detail: outcome.detail }, status)
  }

  return jsonResponse({ media: outcome.media })
})
