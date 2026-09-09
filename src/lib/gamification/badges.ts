import { supabase } from '@/lib/supabase'

export const BADGE_CODES = [
  'streak_3',
  'streak_7',
  'streak_30',
  'first_topic_mastered',
  'five_topics_mastered',
  'ten_topics_mastered',
  'hundred_correct',
  'five_hundred_correct',
] as const

export type BadgeCode = (typeof BADGE_CODES)[number]

export interface BadgeDefinition {
  code: BadgeCode
  icon: string // emoji, so the badge grid has zero extra asset/icon-library dependency
}

// Ordered roughly easiest-to-hardest within each family, purely for display.
export const BADGE_CATALOG: BadgeDefinition[] = [
  { code: 'streak_3', icon: '🔥' },
  { code: 'streak_7', icon: '⚡' },
  { code: 'streak_30', icon: '🏆' },
  { code: 'first_topic_mastered', icon: '🌟' },
  { code: 'five_topics_mastered', icon: '🎯' },
  { code: 'ten_topics_mastered', icon: '👑' },
  { code: 'hundred_correct', icon: '💯' },
  { code: 'five_hundred_correct', icon: '🚀' },
]

export async function fetchEarnedBadges(learnerId: string): Promise<Set<BadgeCode>> {
  const { data } = await supabase.from('learner_badges').select('badge_code').eq('learner_id', learnerId)
  return new Set((data ?? []).map((r) => r.badge_code as BadgeCode))
}

async function awardBadgeIfNew(learnerId: string, code: BadgeCode, alreadyEarned: Set<BadgeCode>): Promise<boolean> {
  if (alreadyEarned.has(code)) return false
  // unique(learner_id, badge_code) makes this idempotent under a race (e.g. two
  // quiz submissions landing close together) -- the losing insert just errors
  // and is ignored, since the badge is already recorded either way.
  const { error } = await supabase.from('learner_badges').insert({ learner_id: learnerId, badge_code: code })
  return !error
}

/**
 * Evaluated after every quiz/practice completion (see recordQuizResult and the
 * V2 practice-completion path in LessonPage). Cheap to run every time: each
 * check is a single indexed count, and awarding a badge that already exists
 * is a no-op via the unique constraint.
 */
export async function checkAndAwardBadges(
  learnerId: string,
  context: { currentStreak: number },
): Promise<BadgeCode[]> {
  const alreadyEarned = await fetchEarnedBadges(learnerId)
  const newlyEarned: BadgeCode[] = []

  const streakMilestones: [number, BadgeCode][] = [
    [30, 'streak_30'],
    [7, 'streak_7'],
    [3, 'streak_3'],
  ]
  for (const [threshold, code] of streakMilestones) {
    if (context.currentStreak >= threshold && (await awardBadgeIfNew(learnerId, code, alreadyEarned))) {
      newlyEarned.push(code)
      alreadyEarned.add(code)
    }
  }

  const { count: masteredTopics } = await supabase
    .from('mastery')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .gte('mastery_score', 80)

  const masteryMilestones: [number, BadgeCode][] = [
    [10, 'ten_topics_mastered'],
    [5, 'five_topics_mastered'],
    [1, 'first_topic_mastered'],
  ]
  for (const [threshold, code] of masteryMilestones) {
    if ((masteredTopics ?? 0) >= threshold && (await awardBadgeIfNew(learnerId, code, alreadyEarned))) {
      newlyEarned.push(code)
      alreadyEarned.add(code)
    }
  }

  const { count: correctCount } = await supabase
    .from('learner_points_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('learner_id', learnerId)
    .eq('reason', 'correct_answer')

  const volumeMilestones: [number, BadgeCode][] = [
    [500, 'five_hundred_correct'],
    [100, 'hundred_correct'],
  ]
  for (const [threshold, code] of volumeMilestones) {
    if ((correctCount ?? 0) >= threshold && (await awardBadgeIfNew(learnerId, code, alreadyEarned))) {
      newlyEarned.push(code)
      alreadyEarned.add(code)
    }
  }

  return newlyEarned
}
