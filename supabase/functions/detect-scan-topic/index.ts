// Supabase Edge Function: detect-scan-topic
//
// "Scan My Work" today only runs a safety check (moderate-upload) and then makes
// the parent manually pick a subject from a list -- it never actually looks at
// what's on the page. This function closes that gap: it looks at the approved
// photo and picks out which curriculum topic it most likely matches, so the app
// can jump straight there instead of asking the parent to browse for it.
//
// Deliberately narrow, mirroring explain-differently's safety posture:
//   - The model is only ever offered a closed list of this learner's own grade's
//     real topic ids as candidates -- it cannot invent a topic, and this
//     function double-checks the id it returns is actually one it was offered
//     before trusting it. There is no free-text output surfaced to a child.
//   - Runs entirely server-side with the caller's own JWT (never a service-role
//     client), so the learner lookup is still subject to the same RLS a browser
//     request would get -- this function cannot be pointed at another family's
//     learner.
//   - The photo is only ever held in memory for the duration of this request; it
//     is never written to storage or logged anywhere by this function.
//   - If ANTHROPIC_API_KEY is not configured, this honestly reports
//     feature_not_configured rather than fabricating a match -- the client falls
//     back to the existing manual subject picker in that case.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32'

const MODEL = 'claude-haiku-4-5'
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

interface DetectionResult {
  detected_language: 'en' | 'af'
  subject_id: string | null
  topic_id: string | null
  confidence: 'high' | 'medium' | 'low'
}

function isDetectionResult(value: unknown): value is DetectionResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    (v.detected_language === 'en' || v.detected_language === 'af') &&
    (v.subject_id === null || typeof v.subject_id === 'string') &&
    (v.topic_id === null || typeof v.topic_id === 'string') &&
    (v.confidence === 'high' || v.confidence === 'medium' || v.confidence === 'low')
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const learnerId = form?.get('learnerId')
  if (!(file instanceof File) || typeof learnerId !== 'string') {
    return jsonResponse({ error: 'missing_file_or_learner' }, 400)
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return jsonResponse({ error: 'unsupported_file_type' }, 400)
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse({ error: 'file_too_large' }, 400)
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) return jsonResponse({ error: 'feature_not_configured' }, 503)

  // Scoped to the caller's own JWT throughout -- never a service-role client.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: learner } = await supabase.from('learners').select('id, grade_id').eq('id', learnerId).maybeSingle()
  if (!learner) return jsonResponse({ error: 'learner_not_found_or_not_owned' }, 404)

  const [{ data: gradeSubjects }, { data: topics }] = await Promise.all([
    supabase.from('grade_subjects').select('sort_order, subjects(id, name, name_af)').eq('grade_id', learner.grade_id).order('sort_order'),
    supabase.from('topics').select('id, subject_id, name, name_af').eq('grade_id', learner.grade_id),
  ])

  const subjects = (gradeSubjects ?? [])
    .map((row) => row.subjects)
    .filter((s): s is { id: string; name: string; name_af: string | null } => Boolean(s))
  if (subjects.length === 0) return jsonResponse({ error: 'no_candidates_for_grade' }, 404)

  const validTopicIds = new Set((topics ?? []).map((t) => t.id))
  const validSubjectIds = new Set(subjects.map((s) => s.id))
  const topicToSubject = new Map((topics ?? []).map((t) => [t.id, t.subject_id]))

  const candidateText = subjects
    .map((s) => {
      const subjectTopics = (topics ?? []).filter((t) => t.subject_id === s.id)
      const topicLines = subjectTopics
        .map((t) => `    - id: ${t.id} | English: "${t.name}"${t.name_af ? ` | Afrikaans: "${t.name_af}"` : ''}`)
        .join('\n')
      return `- Subject id: ${s.id} | English: "${s.name}"${s.name_af ? ` | Afrikaans: "${s.name_af}"` : ''}\n${topicLines || '    (no topics)'}`
    })
    .join('\n')

  const imageBytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (const byte of imageBytes) binary += String.fromCharCode(byte)
  const imageBase64 = btoa(binary)

  const systemPrompt = `You are matching a photo of a South African primary-school worksheet or textbook page to the single closest topic from a fixed list. You must only ever choose an id that appears in the list given to you -- never invent one. Respond with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:
{"detected_language": "en" | "af", "subject_id": "<uuid from the list, or null>", "topic_id": "<uuid from the list, or null>", "confidence": "high" | "medium" | "low"}

Rules:
- detected_language is the main language the visible text on the page is written in.
- If you cannot confidently match the page to any topic in the list (illegible, blank, unrelated content, or genuinely ambiguous between many topics), set both subject_id and topic_id to null and confidence to "low".
- Only set confidence "high" if the page's visible heading or clear subject matter matches one topic closely.`

  const userText = `Candidate subjects and topics for this learner's grade:\n${candidateText}\n\nWhich topic id does this photo match?`

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    })
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const raw = textBlock?.text ?? ''
    if (response.stop_reason === 'refusal' || !raw) {
      return jsonResponse({ error: 'detection_unavailable' }, 502)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }
    if (!isDetectionResult(parsed)) {
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }

    // Never trust the model's ids blindly -- only ever pass through ids that were
    // actually offered as candidates, and that are internally consistent with
    // each other (the topic really belongs to the returned subject).
    let { subject_id: subjectId, topic_id: topicId } = parsed
    if (topicId && (!validTopicIds.has(topicId) || topicToSubject.get(topicId) !== subjectId)) {
      topicId = null
    }
    if (subjectId && !validSubjectIds.has(subjectId)) {
      subjectId = null
    }

    return jsonResponse({
      detectedLanguage: parsed.detected_language,
      subjectId,
      topicId,
      confidence: topicId ? parsed.confidence : 'low',
    })
  } catch (err) {
    console.error(`Anthropic scan detection threw: ${err instanceof Error ? err.message : String(err)}`)
    return jsonResponse({ error: 'detection_unavailable' }, 502)
  }
})
