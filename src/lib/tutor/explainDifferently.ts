import { supabase } from '@/lib/supabase'

export interface AlternateExplanation {
  framing: 'analogy' | 'story' | 'steps' | 'visual'
  explanation: string
  mini_example: string
}

export type ExplainDifferentlyError =
  | 'daily_limit_reached'
  | 'feature_not_configured'
  | 'explanation_unavailable'
  | 'model_output_invalid'
  | 'unknown'

export type ExplainDifferentlyResult =
  | { ok: true; explanation: AlternateExplanation }
  | { ok: false; error: ExplainDifferentlyError }

/**
 * Calls the `explain-differently` Edge Function to get one AI-generated
 * alternate explanation of a topic, grounded in that topic's own curriculum
 * content. See supabase/functions/explain-differently/index.ts for what runs
 * server-side (rate limiting, grounding, child-safety rules).
 */
export async function requestAlternateExplanation(learnerId: string, topicId: string): Promise<ExplainDifferentlyResult> {
  const { data, error } = await supabase.functions.invoke('explain-differently', {
    body: { learnerId, topicId },
  })

  if (error) {
    // supabase-js surfaces non-2xx Edge Function responses as `error` without
    // reliably exposing the parsed body, so the specific reason code (e.g.
    // daily_limit_reached) may not always be recoverable here — the caller
    // still gets a safe, honest fallback message either way.
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    const body = await context?.json?.().catch(() => null)
    const code = body?.error
    if (
      code === 'daily_limit_reached' ||
      code === 'feature_not_configured' ||
      code === 'explanation_unavailable' ||
      code === 'model_output_invalid'
    ) {
      return { ok: false, error: code }
    }
    return { ok: false, error: 'unknown' }
  }

  if (!data?.explanation) {
    return { ok: false, error: 'unknown' }
  }

  return { ok: true, explanation: data.explanation as AlternateExplanation }
}
