// Supabase Edge Function: generate-topic-illustration
//
// Admin-triggered: generates one illustrative image per topic using an image
// AI provider (OpenAI's DALL-E 3), stores it in the public `topic-illustrations`
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

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  // Scoped to the caller's own JWT throughout -- this function never uses a
  // service-role client. The admin check below is the real gate; RLS on
  // `admins`, `topics`, and `media` provides defense in depth underneath it.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)

  const { data: adminRow } = await supabase.from('admins').select('id').eq('id', user.id).maybeSingle()
  if (!adminRow) return jsonResponse({ error: 'admin_only' }, 403)

  const { data: topic } = await supabase.from('topics').select('name, subject_id, grade_id').eq('id', topicId).maybeSingle()
  if (!topic) return jsonResponse({ error: 'topic_not_found' }, 404)

  const [{ data: subject }, { data: grade }] = await Promise.all([
    supabase.from('subjects').select('name').eq('id', topic.subject_id).maybeSingle(),
    supabase.from('grades').select('grade_number').eq('id', topic.grade_id).maybeSingle(),
  ])

  const gradeNumber = grade?.grade_number ?? 5
  const subjectName = subject?.name ?? ''

  const prompt = `A simple, friendly, flat-vector illustration for a South African Grade ${gradeNumber} classroom, depicting the theme of "${topic.name}" (${subjectName}). Warm, inclusive, colourful, cheerful mood suitable for a child aged 9-13. Clean flat-vector illustration style with soft rounded shapes, no realistic human faces, no logos or brand names, no violent or scary imagery. STRICT REQUIREMENT: absolutely no text, letters, numbers, words, or writing of any kind anywhere in the image -- a purely visual scene only.`

  let imageBase64: string
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      console.error(`OpenAI image generation failed: ${response.status} ${detail}`)
      return jsonResponse({ error: 'image_generation_failed' }, 502)
    }
    const result = await response.json()
    imageBase64 = result?.data?.[0]?.b64_json
    if (!imageBase64) return jsonResponse({ error: 'image_generation_failed' }, 502)
  } catch (err) {
    console.error(`OpenAI image generation threw: ${err instanceof Error ? err.message : String(err)}`)
    return jsonResponse({ error: 'image_generation_failed' }, 502)
  }

  const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
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
      source: 'ai_generated:dall-e-3',
      language: 'en',
    })
    .select()
    .single()
  if (mediaError) {
    console.error(`media insert failed: ${mediaError.message}`)
    return jsonResponse({ error: 'media_insert_failed' }, 500)
  }

  return jsonResponse({ media: mediaRow })
})
