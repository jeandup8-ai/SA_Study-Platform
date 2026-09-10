// Supabase Edge Function: detect-scan-topic
//
// "Scan My Work" today only runs a safety check (moderate-upload) and then makes
// the parent manually pick a subject from a list -- it never actually looks at
// what's on the page. This function closes that gap: it looks at the approved
// photo and picks out which curriculum topic it most likely matches, so the app
// can jump straight there instead of asking the parent to browse for it.
//
// It also runs a second, narrower pass once a topic is confidently identified:
// a curriculum-grounded look at the same photo for one short, encouraging
// observation about what to check -- e.g. a visible working-out error -- so a
// scan doesn't just say "here's the topic" but can also say "here's what to
// look at again", the same way a tutor glancing at the page would. This mirrors
// explain-differently's grounding technique (topic learning objectives +
// verified terminology, nothing else) rather than a free-ended "what's wrong
// with this" prompt.
//
// IMPORTANT: this calls the Anthropic Messages API via plain `fetch`, not the
// `@anthropic-ai/sdk` npm package. Production logs showed every single
// invocation of this function logging "Couldn't load zlib" / "Couldn't load
// fs" on boot, followed by the SDK's HTTP call throwing a bare "Connection
// error" 100% of the time (three separate attempts across increasing
// backoff, on two separate days, all failed identically) -- while every
// other Supabase-JS `fetch`-based call in this exact function (the `learners`
// / `topics` queries above) succeeded every time. That pattern points at the
// SDK's Node-oriented HTTP transport failing under this specific Deno edge
// runtime's npm compatibility layer, not a real network outage. Deno's native
// `fetch` is what supabase-js itself already relies on successfully here, so
// this function talks to Anthropic the same way, sidestepping the SDK's
// transport entirely.
//
// Deliberately narrow, mirroring explain-differently's safety posture:
//   - The model is only ever offered a closed list of this learner's own grade's
//     real topic ids as candidates -- it cannot invent a topic, and this
//     function double-checks the id it returns is actually one it was offered
//     before trusting it. There is no free-text output surfaced to a child.
//   - The mistake-feedback pass is grounded ONLY in the resolved topic's own
//     learning objectives and verified terminology -- never open-ended
//     knowledge -- and only ever runs after topic detection has already
//     resolved a real topic id from the closed candidate list above.
//   - Runs entirely server-side with the caller's own JWT (never a service-role
//     client), so the learner lookup is still subject to the same RLS a browser
//     request would get -- this function cannot be pointed at another family's
//     learner.
//   - Rate-limited per learner per day (see scan_mistake_feedback), same
//     reasoning as explain-differently: bounds worst-case LLM cost per family.
//   - The photo is only ever held in memory for the duration of this request; it
//     is never written to storage, and is never itself logged -- only the
//     resulting text feedback is (see scan_mistake_feedback).
//   - If ANTHROPIC_API_KEY is not configured, this honestly reports
//     feature_not_configured rather than fabricating a match -- the client falls
//     back to the existing manual subject picker in that case.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding/base64'

const MODEL = 'claude-haiku-4-5'
const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MISTAKE_FEEDBACK_DAILY_LIMIT = 10
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

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

interface ClaudeMessage {
  content: { type: string; text?: string }[]
  stop_reason: string
  usage: { input_tokens: number; output_tokens: number }
}

interface ImageContentBlock {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
}

/**
 * Plain `fetch` to the Anthropic Messages API -- see the file header for why
 * this bypasses the SDK. Retries absorb a genuine transient network blip
 * (still possible even with a native fetch); a run that fails all three
 * attempts surfaces exactly as before rather than masking a real problem.
 */
async function callClaude(
  apiKey: string,
  body: { model: string; max_tokens: number; system: string; messages: { role: 'user'; content: (ImageContentBlock | { type: 'text'; text: string })[] }[] },
): Promise<ClaudeMessage> {
  const backoffsMs = [500, 1500]
  let lastErr: unknown
  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`Anthropic API responded ${res.status}: ${errorText.slice(0, 500)}`)
      }
      return (await res.json()) as ClaudeMessage
    } catch (err) {
      lastErr = err
      if (attempt < backoffsMs.length) {
        console.error(
          `Anthropic call failed (attempt ${attempt + 1}/${backoffsMs.length + 1}), retrying: ${err instanceof Error ? err.message : String(err)}`,
        )
        await new Promise((resolve) => setTimeout(resolve, backoffsMs[attempt]))
      }
    }
  }
  throw lastErr
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

  const { data: learner } = await supabase
    .from('learners')
    .select('id, grade_id, preferred_language')
    .eq('id', learnerId)
    .maybeSingle()
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
  const imageBase64 = encodeBase64(imageBytes)
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const systemPrompt = `You are matching a photo of a South African primary-school worksheet or textbook page to the single closest topic from a fixed list. You must only ever choose an id that appears in the list given to you -- never invent one. Respond with ONLY a single JSON object, no markdown, no code fences, matching exactly this shape:
{"detected_language": "en" | "af", "subject_id": "<uuid from the list, or null>", "topic_id": "<uuid from the list, or null>", "confidence": "high" | "medium" | "low"}

Rules:
- detected_language is the main language the visible text on the page is written in.
- If you cannot confidently match the page to any topic in the list (illegible, blank, unrelated content, or genuinely ambiguous between many topics), set both subject_id and topic_id to null and confidence to "low".
- Only set confidence "high" if the page's visible heading or clear subject matter matches one topic closely.`

  const userText = `Candidate subjects and topics for this learner's grade:\n${candidateText}\n\nWhich topic id does this photo match?`

  try {
    const response = await callClaude(anthropicKey, {
      model: MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
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

    const confidence = topicId ? parsed.confidence : 'low'

    let mistakeFeedback: string | null = null
    if (topicId && confidence !== 'low') {
      mistakeFeedback = await generateMistakeFeedback({
        supabase,
        anthropicKey,
        learnerId,
        topicId,
        language: learner.preferred_language as 'en' | 'af',
        imageBase64,
        mediaType,
      })
    }

    return jsonResponse({
      detectedLanguage: parsed.detected_language,
      subjectId,
      topicId,
      confidence,
      mistakeFeedback,
    })
  } catch (err) {
    console.error(`Anthropic scan detection threw: ${err instanceof Error ? err.message : String(err)}`)
    return jsonResponse({ error: 'detection_unavailable' }, 502)
  }
})

/**
 * Second, narrower pass: grounded ONLY in the resolved topic's own learning
 * objectives and verified terminology (the exact same grounding technique as
 * explain-differently), this looks at the same photo again for one short,
 * encouraging observation about what to check. Returns null on any failure,
 * rate-limit, or when the model finds nothing worth flagging -- this is a
 * best-effort enhancement layered on top of topic detection, never something
 * detection's own success should depend on.
 */
async function generateMistakeFeedback(params: {
  supabase: ReturnType<typeof createClient>
  anthropicKey: string
  learnerId: string
  topicId: string
  language: 'en' | 'af'
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
}): Promise<string | null> {
  const { supabase, anthropicKey, learnerId, topicId, language, imageBase64, mediaType } = params

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('scan_mistake_feedback')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .gte('created_at', startOfToday.toISOString())
  if ((todayCount ?? 0) >= MISTAKE_FEEDBACK_DAILY_LIMIT) return null

  const { data: topic } = await supabase.from('topics').select('name, name_af, subject_id').eq('id', topicId).maybeSingle()
  if (!topic) return null

  const [{ data: objectives }, { data: terminology }] = await Promise.all([
    supabase.from('learning_objectives').select('description').eq('topic_id', topicId),
    supabase
      .from('terminology')
      .select('term, translation, definition')
      .eq('subject_id', topic.subject_id)
      .eq('language', language)
      .eq('verified', true),
  ])

  const languageName = language === 'af' ? 'Afrikaans' : 'English'
  const topicName = language === 'af' && topic.name_af ? topic.name_af : topic.name
  const objectivesText = (objectives ?? []).map((o) => `- ${o.description}`).join('\n') || '(none on file)'
  const terminologyText =
    (terminology ?? []).map((t) => `- ${t.term}${t.translation ? ` (${t.translation})` : ''}: ${t.definition ?? ''}`).join('\n') ||
    '(none on file)'

  const systemPrompt = `You are looking at a photo of a South African primary-school child's work on the topic "${topicName}". Respond only in ${languageName}.

STRICT RULES:
1. Use ONLY the curriculum content given below (learning objectives, key terms) to judge what's correct. Do not introduce any fact, number, or rule not grounded in this content.
2. Look at any visible working-out or answers on the page. If you can identify one specific, concrete thing worth double-checking (a likely mistake, a common misconception, or a step that looks skipped), describe it in ONE short, warm, encouraging sentence (max 30 words) -- never say "wrong" or "incorrect", frame it as "double-check..." or "have another look at...".
3. If the work looks correct, or you cannot make out enough detail to say anything concrete and specific, return null for feedback -- never guess or invent a generic comment.
4. Never ask the child for personal information, never suggest contacting anyone, never include links, and never claim to be a human.
5. Output ONLY a single JSON object, no markdown, no code fences: {"feedback": "<one short sentence, or null>"}

Learning objectives for this topic:
${objectivesText}

Key terms for this subject:
${terminologyText}`

  try {
    const response = await callClaude(anthropicKey, {
      model: MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'What, if anything, is worth double-checking in this work?' },
          ],
        },
      ],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    const raw = textBlock?.text ?? ''
    if (response.stop_reason === 'refusal' || !raw) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    const feedback =
      parsed && typeof parsed === 'object' && 'feedback' in parsed && typeof (parsed as { feedback: unknown }).feedback === 'string'
        ? (parsed as { feedback: string }).feedback
        : null

    await supabase.from('scan_mistake_feedback').insert({
      learner_id: learnerId,
      topic_id: topicId,
      feedback,
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    return feedback
  } catch (err) {
    console.error(`Anthropic mistake-feedback threw: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}
