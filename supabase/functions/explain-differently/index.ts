// Supabase Edge Function: explain-differently
//
// "Explain a different way" — the only AI-tutor action in this product that calls
// a real LLM. Deliberately narrow in scope for child safety:
//
//   - The client only ever sends { learnerId, topicId }. There is no free-text
//     input from the child anywhere in this flow, so there is no
//     prompt-injection surface on the child's side — the app never gives a
//     child a text box to type anything to an AI.
//   - Every fact the model is allowed to use is assembled server-side from this
//     topic's own reviewed curriculum content (learning objectives, verified
//     terminology, the learner's own recent wrong answer) — never open-ended
//     knowledge. The system prompt hard-instructs the model not to introduce
//     anything outside that content.
//   - Runs entirely server-side: the Anthropic API key never reaches the
//     client, and the Supabase client here is created with the *caller's own*
//     JWT (not a service-role key), so every query is still subject to the
//     same RLS policies a browser request would get — this function cannot
//     read or write another family's data even if a bug tried to.
//   - Rate-limited per learner per day (see checkDailyLimit) — this bounds
//     worst-case LLM cost per family per month and, pedagogically, nudges
//     toward actually attempting the practice questions rather than
//     button-mashing for a different explanation.
//   - If ANTHROPIC_API_KEY is not configured, this function says so
//     (feature_not_configured) rather than silently failing or fabricating a
//     response — same "never fake success" posture as moderate-upload.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@0.32'

const DAILY_LIMIT_PER_LEARNER = 5
const MODEL = 'claude-haiku-4-5'
const FRAMINGS = ['analogy', 'story', 'steps', 'visual'] as const
type Framing = (typeof FRAMINGS)[number]

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

interface ExplanationResult {
  framing: Framing
  explanation: string
  mini_example: string
}

function isExplanationResult(value: unknown): value is ExplanationResult {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.framing === 'string' &&
    (FRAMINGS as readonly string[]).includes(v.framing) &&
    typeof v.explanation === 'string' &&
    v.explanation.length > 0 &&
    typeof v.mini_example === 'string' &&
    v.mini_example.length > 0
  )
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
    .select('display_name, preferred_language, grade_id, curriculum_id')
    .eq('id', learnerId)
    .maybeSingle()
  if (!learner) return jsonResponse({ error: 'learner_not_found_or_not_owned' }, 404)

  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('tutor_explanations')
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

  const [{ data: objectives }, { data: terminology }, { data: priorExplanations }] = await Promise.all([
    supabase.from('learning_objectives').select('description').eq('topic_id', topicId),
    supabase
      .from('terminology')
      .select('term, translation, definition')
      .eq('subject_id', topic.subject_id)
      .eq('language', language)
      .eq('verified', true),
    supabase.from('tutor_explanations').select('framing').eq('learner_id', learnerId).eq('topic_id', topicId),
  ])

  const usedFramings = new Set((priorExplanations ?? []).map((e) => e.framing))
  const availableFraming = FRAMINGS.find((f) => !usedFramings.has(f)) ?? FRAMINGS[usedFramings.size % FRAMINGS.length]

  const { data: lastAttempt } = await supabase
    .from('assessment_attempts')
    .select('id')
    .eq('learner_id', learnerId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let recentMistake: { prompt: string; theirAnswer: string | null; correctAnswer: string } | null = null
  if (lastAttempt) {
    const { data: wrongAnswers } = await supabase
      .from('assessment_answers')
      .select('question_id, answer_text')
      .eq('attempt_id', lastAttempt.id)
      .eq('is_correct', false)
      .limit(1)
    if (wrongAnswers && wrongAnswers.length > 0) {
      const { data: question } = await supabase
        .from('questions')
        .select('prompt, correct_answer, topic_id')
        .eq('id', wrongAnswers[0].question_id)
        .maybeSingle()
      if (question && question.topic_id === topicId) {
        recentMistake = {
          prompt: question.prompt,
          theirAnswer: wrongAnswers[0].answer_text,
          correctAnswer: question.correct_answer,
        }
      }
    }
  }

  const languageName = language === 'af' ? 'Afrikaans' : 'English'
  const objectivesText = (objectives ?? []).map((o) => `- ${o.description}`).join('\n') || '(none on file)'
  const terminologyText =
    (terminology ?? []).map((t) => `- ${t.term}${t.translation ? ` (${t.translation})` : ''}: ${t.definition ?? ''}`).join('\n') ||
    '(none on file)'
  const mistakeText = recentMistake
    ? `The child recently got this question wrong — address this specific mistake if it fits naturally:\nQuestion: ${recentMistake.prompt}\nTheir answer: ${recentMistake.theirAnswer ?? '(no answer given)'}\nCorrect answer: ${recentMistake.correctAnswer}`
    : '(no recent wrong answer on file for this topic)'

  const systemPrompt = `You are a curriculum-grounded tutor helper for a South African primary school child, Grade ${gradeNumber}, ${curriculum?.code ?? 'CAPS'} curriculum. Respond only in ${languageName}.

STRICT RULES — follow all of them:
1. Use ONLY the curriculum content given below (learning objectives, key terms). Do not introduce any fact, number, name, or claim that is not grounded in this content. If you are unsure, keep the explanation general rather than inventing detail.
2. Use this framing for your explanation, and only this one: "${availableFraming}" (analogy = a real-world comparison; story = a very short narrative; steps = a numbered step-by-step walkthrough; visual = a description of a picture or diagram in words).
3. Write at a Grade ${gradeNumber} reading level: short sentences, simple words, warm and encouraging tone. Explanation should be roughly 80-150 words.
4. If a recent wrong answer is provided below, gently address that specific misunderstanding as part of the explanation.
5. This topic and its content are the only valid subject matter. Never ask the child for personal information (name, address, school, age, photos), never suggest meeting anyone or contacting anyone, never include external links, phone numbers, or contact details, and never claim to be a human or a friend — you are a study helper.
6. Output ONLY a single JSON object, with no markdown formatting and no code fences, matching exactly this shape:
{"framing": "${availableFraming}", "explanation": "<80-150 word explanation>", "mini_example": "<one short worked example, 1-3 sentences>"}`

  const userPrompt = `Topic: ${topicName}

Learning objectives for this topic:
${objectivesText}

Key terms for this subject:
${terminologyText}

${mistakeText}

Generate one alternate explanation of this topic using the "${availableFraming}" framing, grounded only in the content above.`

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  let raw: string
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    raw = textBlock?.text ?? ''

    if (response.stop_reason === 'refusal' || !raw) {
      return jsonResponse({ error: 'explanation_unavailable' }, 502)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }
    if (!isExplanationResult(parsed)) {
      return jsonResponse({ error: 'model_output_invalid' }, 502)
    }

    const { error: insertError } = await supabase.from('tutor_explanations').insert({
      learner_id: learnerId,
      topic_id: topicId,
      framing: parsed.framing,
      explanation: parsed,
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })
    if (insertError) {
      return jsonResponse({ error: 'logging_failed' }, 500)
    }

    return jsonResponse({ explanation: parsed })
  } catch {
    return jsonResponse({ error: 'explanation_unavailable' }, 502)
  }
})
