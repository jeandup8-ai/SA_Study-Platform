import { supabase } from '@/lib/supabase'
import { edgeModerationProvider } from './edgeProvider'
import type { ModerationResult } from './types'

export type { ModerationDecision, ModerationReasonCode, ModerationResult, ModerationProvider } from './types'

// Single swap point: point this at a different ModerationProvider implementation
// to change providers. Nothing outside this module needs to change.
export const moderationProvider = edgeModerationProvider

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
    visual_safety_checked: params.result.visualSafetyChecked,
    provider: moderationProvider.name,
  })
}
