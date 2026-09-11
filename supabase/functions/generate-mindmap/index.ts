// Supabase Edge Function: generate-mindmap
//
// "Mind map" — a simplified visual mind map of the current topic. Same
// safety posture as explain-differently (see that function's header
// comment for the full rationale, repeated briefly here):
//
//   - The client only ever sends { learnerId, topicId } — no free-text
//     input from the child, so no prompt-injection surface on the child's
//     side.
//   - Every fact the model may use comes from this topic's own reviewed
//     curriculum content (learning objectives, verified terminology) —
//     never open-ended knowledge. The system prompt hard-instructs the
//     model not to introduce anything outside that content.
//   - Runs entirely server-side with the *caller's own* JWT, never a
//     service-role client, so this function is bound by the same RLS a
//     browser request would get.
//   - Rate-limited per learner per day, via its own tutor_mindmaps table —
//     kept separate from tutor_explanations' limit so the two AI actions
//     don't silently share (and exhaust) each other's daily budget.
//   - If ANTHROPIC_API_KEY is not configured, says so (feature_not_configured)
//     rather than silently failing or fabricating a response.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32'

const DAILY_LIMIT_PER_LEARNER = 5
const MODEL = 'claude-haiku-4-5'
const MIN_BRANCHES = 3
const MAX_BRANCHES = 6
const MAX_CHILDREN_PER_BRANCH = 4

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

interface MindMapBranch {
  label: string
  children: string[]
}
interface MindMapResult {
  central: string
  branches: MindMapBranch[]
}

function isMindMapResult(value: unknown): value is MindMapResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.central !== 'string' || v.central.length === 0) return false
  if (!Array.isArray(v.branches) || v.branches.length < MIN_BRANCHES || v.branches.length > MAX_BRANCHES) return false
  return v.branches.every((b) => {
    if (!b || typeof b !== 'object') return false
    const branch = b as Record<string, unknown>
    return (
      typeof branch.label === 'string' &&
      branch.label.length > 0 &&
      Array.isArray(branch.children) &&
      branch.children.length > 0 &&
      branch.children.length <= MAX_CHILDREN_PER_BRANCH &&
      branch.children.every((c) => typeof c === 'string' && c.length > 0)
    )
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'missing_authorization' }, 401)

  const body = await req.json().catch(() => null)
  const learnerId = body?.learnerId
  const topicId = body?.topicId
  if (typeof learnerId !== 'string' || typeof topicId !== 'string') {
    return jsonResponse({ error: 'missing_learner_or_topic' }, 400)
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) {
    return jsonResponse({ error: 'feature_not_configured' }, 503)
  }

  // Scoped to the calling parent's own JWT — every query below is subject to
  // the same RLS policies the browser client would get. Never a service-role
  // client here.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: learner } = await supabase
    .from('learners')
    .select('preferred_language, grade_id, curriculum_id')
    .eq('id', learnerId)
    .maybeSingle()
  if (!learner) return jsonResponse({ error: 'learner_not_found_or_not_owned' }, 404)

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('tutor_mindmaps')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .gte('created_at', startOfToday.toISOString())
  if ((todayCount ?? 0) >= DAILY_LIMIT_PER_LEARNER) {
    return jsonResponse({ error: 'daily_limit_reached', limit: DAILY_LIMIT_PER_LEARNER }, 429)
  }

  const [{ data: grade }, { data: curriculum }, { data: topic }] = await Promise.all([
    supabase.from('grades').select('grade_number').eq('id', learner.grade_id).maybeSingle(),
    supabase.from('curricula').select('code').eq('id', learner.curriculum_id).maybeSingle(),
    supabase.from('topics').select('id, name, name_af, subject_id').eq('id', topicId).maybeSingle(),
  ])
  if (!topic) return jsonResponse({ error: 'topic_not_found' }, 404)

  const gradeNumber = grade?.grade_number ?? 0
  const language = learner.preferred_language as 'en' | 'af'
  const topicName = language === 'af' && topic.name_af ? topic.name_af : topic.name

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
  const objectivesText = (objectives ?? []).map((o) => `- ${o.description}`).join('\n') || '(none on file)'
  const terminologyText =
    (terminology ?? []).map((t) => `- ${t.term}${t.translation ? ` (${t.translation})` : ''}: ${t.definition ?? ''}`).join('\n') ||
    '(none on file)'

  const systemPrompt = `You are a curriculum-grounded tutor helper for a South African primary school child, Grade ${gradeNumber}, ${curriculum?.code ?? 'CAPS'} curriculum. Respond only in ${languageName}.

STRICT RULES — follow all of them:
1. Use ONLY the curriculum content given below (learning objectives, key terms). Do not introduce any fact, number, name, or claim that is not grounded in this content.
2. Build a SIMPLIFIED mind map: one short central topic label, ${MIN_BRANCHES}-${MAX_BRANCHES} main branches, each with 1-${MAX_CHILDREN_PER_BRANCH} short child points. This must be genuinely simple — a Grade ${gradeNumber} child should be able to read the whole thing in under a minute.
3. Every label must be SHORT: the central topic label at most 6 words, each branch label at most 4 words, each child point at most 6 words. No full sentences, no explanations — a mind map is keywords and short phrases only.
4. Write at a Grade ${gradeNumber} reading level: simple, familiar words.
5. This topic and its content are the only valid subject matter. Never ask the child for personal information, never suggest meeting or contacting anyone, never include external links, phone numbers, or contact details, and never claim to be a human or a friend.
6. Output ONLY a single JSON object, with no markdown formatting and no code fences, matching exactly this shape:
{"central": "<short central topic label>", "branches": [{"label": "<short branch label>", "children": ["<short point>", "..."]}, ...]}`

  const userPrompt = `Topic: ${topicName}

Learning objectives for this topic:
${objectivesText}

Key terms for this subject:
${terminologyText}

Generate one simplified mind map of this topic, grounded only in the content above.`

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    raw = textBlock?.text ?? ''

    if (response.stop_reason === 'refusal' || !raw) {
      console.error(`generate-mindmap: stop_reason=${response.stop_reason} rawLength=${raw.length}`)
      return jsonResponse({ error: 'mindmap_unavailable' }, 502)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (parseErr) {
      console.error(`generate-mindmap: JSON.parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)} | raw: ${raw.slice(0, 500)}`)
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }
    if (!isMindMapResult(parsed)) {
      console.error(`generate-mindmap: isMindMapResult failed | raw: ${raw.slice(0, 500)}`)
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }

    const { error: insertError } = await supabase.from('tutor_mindmaps').insert({
      learner_id: learnerId,
      topic_id: topicId,
      mindmap: parsed,
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })
    if (insertError) {
      console.error(`generate-mindmap: tutor_mindmaps insert failed: ${insertError.message}`)
      return jsonResponse({ error: 'logging_failed' }, 500)
    }

    return jsonResponse({ mindmap: parsed })
  } catch (err) {
    const status = (err as { status?: number })?.status
    const cause = (err as { cause?: unknown })?.cause
    console.error(
      `generate-mindmap: Anthropic call threw${status ? ` (status ${status})` : ''}: ${err instanceof Error ? err.message : String(err)}` +
        (cause ? ` | cause: ${cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)}` : ''),
    )
    return jsonResponse({ error: 'mindmap_unavailable' }, 502)
  }
})
