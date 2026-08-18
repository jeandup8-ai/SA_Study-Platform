import { supabase } from '@/lib/supabase'
import type { ModerationProvider, ModerationResult } from './types'

/**
 * Real moderation, enforced server-side. The client never decides what's safe —
 * it calls the `moderate-upload` Supabase Edge Function (see
 * supabase/functions/moderate-upload/index.ts), which:
 *   1. Re-validates file type/size itself (never trusts the client's own check).
 *   2. Reads real EXIF GPS metadata out of the photo.
 *   3. If a vision-safety provider is configured (Sightengine, via Edge Function
 *      secrets — never in this repo), sends the image to it for nudity/weapons/
 *      drugs/gore/offensive-content detection and rejects on a positive match.
 *
 * If no provider is configured yet, the function still runs (structural checks
 * only) and reports `visualSafetyChecked: false` so the UI can be honest that the
 * deep visual scan didn't run — it does not silently pretend to have checked.
 *
 * FAIL CLOSED: any network failure, non-2xx response, or unexpected shape from
 * the Edge Function is treated as a rejection, never as an approval. A child's
 * upload should never bypass moderation because a request timed out.
 */
export const edgeModerationProvider: ModerationProvider = {
  name: 'edge:moderate-upload',
  async moderateFile(file, options): Promise<ModerationResult> {
    try {
      const form = new FormData()
      form.append('file', file)
      if (options?.simulateUnsafe) form.append('simulateUnsafe', 'true')

      const { data, error } = await supabase.functions.invoke('moderate-upload', { body: form })

      if (error || !data || (data.decision !== 'approved' && data.decision !== 'rejected')) {
        return { decision: 'rejected', reasonCodes: ['moderation_provider_error'], visualSafetyChecked: false }
      }

      return {
        decision: data.decision,
        reasonCodes: Array.isArray(data.reasonCodes) ? data.reasonCodes : [],
        visualSafetyChecked: Boolean(data.visualSafetyChecked),
      }
    } catch {
      return { decision: 'rejected', reasonCodes: ['moderation_provider_error'], visualSafetyChecked: false }
    }
  },
}
