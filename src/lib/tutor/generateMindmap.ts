import { supabase } from '@/lib/supabase'

export interface MindMapBranch {
  label: string
  children: string[]
}

export interface MindMap {
  central: string
  branches: MindMapBranch[]
}

export type GenerateMindMapError =
  | 'daily_limit_reached'
  | 'feature_not_configured'
  | 'mindmap_unavailable'
  | 'model_output_invalid'
  | 'unknown'

export type GenerateMindMapResult = { ok: true; mindmap: MindMap } | { ok: false; error: GenerateMindMapError }

/**
 * Calls the `generate-mindmap` Edge Function to get one AI-generated,
 * simplified mind map of a topic, grounded in that topic's own curriculum
 * content. See supabase/functions/generate-mindmap/index.ts for what runs
 * server-side (rate limiting, grounding, child-safety rules).
 */
export async function generateMindMap(learnerId: string, topicId: string): Promise<GenerateMindMapResult> {
  const { data, error } = await supabase.functions.invoke('generate-mindmap', {
    body: { learnerId, topicId },
  })

  if (error) {
    // supabase-js surfaces non-2xx Edge Function responses as `error` without
    // reliably exposing the parsed body, so the specific reason code (e.g.
    // daily_limit_reached) may not always be recoverable here — the caller
    // still gets a safe, honest fallback message either way.
    const context = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
    const responseBody = await context?.json?.().catch(() => null)
    const code = responseBody?.error
    if (
      code === 'daily_limit_reached' ||
      code === 'feature_not_configured' ||
      code === 'mindmap_unavailable' ||
      code === 'model_output_invalid'
    ) {
      return { ok: false, error: code }
    }
    return { ok: false, error: 'unknown' }
  }

  if (!data?.mindmap) {
    return { ok: false, error: 'unknown' }
  }

  return { ok: true, mindmap: data.mindmap as MindMap }
}
