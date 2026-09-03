import { supabase } from '@/lib/supabase'

export interface StreakInfo {
  currentStreak: number
  practisedToday: boolean
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10) // ISO timestamps are UTC ("YYYY-MM-DDTHH:mm:ss.sssZ") — safe to slice.
}

/**
 * Consecutive-day study streak, computed from study_sessions (written whenever
 * a learner completes practice questions or a mini quiz — see
 * lib/mastery/engine.ts). A streak is not considered broken until a full UTC
 * day has been skipped, matching the usual "streak" convention: doing today's
 * practice still shows yesterday's streak intact even before today's session
 * is logged.
 */
export async function fetchStreak(learnerId: string): Promise<StreakInfo> {
  const { data } = await supabase
    .from('study_sessions')
    .select('started_at')
    .eq('learner_id', learnerId)
    .order('started_at', { ascending: false })
    .limit(200)

  if (!data || data.length === 0) return { currentStreak: 0, practisedToday: false }

  const practisedDates = new Set(data.map((row) => toDateKey(row.started_at)))

  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  const todayKey = cursor.toISOString().slice(0, 10)
  const practisedToday = practisedDates.has(todayKey)

  if (!practisedToday) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  let currentStreak = 0
  while (practisedDates.has(cursor.toISOString().slice(0, 10))) {
    currentStreak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return { currentStreak, practisedToday }
}
