// Supabase Edge Function: generate-topic-illustrations-batch
//
// Fills in the missing topic illustrations, a handful at a time.
//
// Why this exists alongside `generate-topic-illustration`: that one is the
// admin's button in the Illustration Studio and is authenticated by the
// calling admin's own JWT, which is exactly right for one topic at a time.
// Seeding the whole curriculum is a backend batch job instead -- it has to
// read across every topic, it runs for minutes, and nobody is sitting in
// front of a browser while it does. So, like `weekly-parent-digest`, it uses
// the service-role key and is deployed with verify_jwt=false, and the shared
// CRON_SECRET is what guards it -- checked before anything else runs.
//
// Two things are deliberately kept narrow, because this endpoint can spend
// money at an image provider:
//   - `limit` is capped at MAX_LIMIT per call, so a single request can never
//     run away. Drive the full curriculum by calling it repeatedly.
//   - `dryRun` reports exactly which topics the same call would generate for,
//     without contacting the provider at all. Use it first.
//
// What it does NOT do is publish anything. Every image lands as
// approval_status='pending', identical to the admin path, and the media_read
// RLS policy keeps it away from learners until a human approves it. The
// review gate is untouched.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { generateAndStore, type TopicRow } from '../generate-topic-illustration/generate.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// An image takes roughly 15-30 seconds. The function's own wall clock is the
// real constraint, so a call stays well inside it: at most MAX_LIMIT topics,
// CONCURRENCY at a time.
const DEFAULT_LIMIT = 4
const MAX_LIMIT = 12
const CONCURRENCY = 3

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const body = await req.json().catch(() => null)
  const dryRun = body?.dryRun === true
  const requested = Number(body?.limit)
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Every real topic, and every image already attached to one. A topic counts
  // as done when it has an image that is pending or approved -- a rejected
  // image means a human looked at it and wanted another, so it gets another.
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, name, subject_id, grade_id')
    .eq('is_demo_content', false)
    .order('name', { ascending: true })
  if (topicsError) return jsonResponse({ error: 'topics_query_failed', detail: topicsError.message }, 500)

  const { data: existing, error: mediaError } = await supabase
    .from('media')
    .select('topic_id, approval_status')
    .eq('media_type', 'image')
    .in('approval_status', ['pending', 'approved'])
  if (mediaError) return jsonResponse({ error: 'media_query_failed', detail: mediaError.message }, 500)

  const covered = new Set((existing ?? []).map((row: { topic_id: string | null }) => row.topic_id))
  const outstanding: TopicRow[] = (topics ?? []).filter((t: TopicRow) => !covered.has(t.id))
  const batch = outstanding.slice(0, limit)

  if (dryRun) {
    return jsonResponse({
      dryRun: true,
      totalTopics: topics?.length ?? 0,
      covered: covered.size,
      outstanding: outstanding.length,
      wouldGenerate: batch.map((t) => ({ id: t.id, name: t.name })),
    })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  const succeeded: { id: string; name: string; model: string }[] = []
  const failed: { id: string; name: string; error: string; detail: string }[] = []

  const queue = [...batch]
  async function worker() {
    for (;;) {
      const topic = queue.shift()
      if (!topic) return
      const outcome = await generateAndStore(supabase, openaiKey!, topic)
      if (outcome.ok) succeeded.push({ id: topic.id, name: topic.name, model: outcome.usedModel })
      else
        failed.push({
          id: topic.id,
          name: topic.name,
          error: outcome.error,
          detail: outcome.detail.slice(0, 200),
        })
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
  )

  return jsonResponse({
    attempted: batch.length,
    succeeded,
    failed,
    // What is left after this call, so the caller knows whether to go again.
    remaining: outstanding.length - succeeded.length,
  })
})
