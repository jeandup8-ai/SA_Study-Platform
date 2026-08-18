import { supabase } from '@/lib/supabase'
import { mockModerationProvider } from './mockProvider'
import type { ModerationResult } from './types'

export type { ModerationDecision, ModerationReasonCode, ModerationResult, ModerationProvider } from './types'

// Single swap point: replace with a real provider implementation once one is
// integrated. Nothing outside this module needs to change.
export const moderationProvider = mockModerationProvider

export async function logModerationDecision(params: {
  learnerId: string
  parentId: string
  contentType: 'image' | 'pdf'
  result: ModerationResult
}) {
  await supabase.from('moderation_logs').insert({
    learner_id: params.learnerId,
    parent_id: params.parentId,
    content_type: params.contentType,
    decision: params.result.decision,
    reasons: params.result.reasonCodes,
    provider: moderationProvider.name,
  })
}
