import { supabase } from '@/lib/supabase'

/**
 * Weekly digest opt-in state for the signed-in parent. Reads and writes go
 * through the parents table under the existing parents_select_self /
 * parents_update_self policies, so a parent can only ever see or change their
 * own preference.
 */
export async function fetchWeeklyDigestEnabled(parentId: string): Promise<boolean> {
  const { data } = await supabase
    .from('parents')
    .select('weekly_digest_enabled')
    .eq('id', parentId)
    .maybeSingle()
  // Default to on when the row can't be read — matches the column default, and
  // an unreadable preference should not silently look like an opt-out.
  return data?.weekly_digest_enabled ?? true
}

export async function setWeeklyDigestEnabled(parentId: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('parents')
    .update({ weekly_digest_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', parentId)
  return !error
}
