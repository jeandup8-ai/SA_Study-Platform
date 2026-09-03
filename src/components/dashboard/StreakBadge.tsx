import { useTranslation } from 'react-i18next'
import type { StreakInfo } from '@/lib/streak/streak'

export function StreakBadge({ streak }: { streak: StreakInfo | null }) {
  const { t } = useTranslation()
  if (!streak || streak.currentStreak === 0) return null

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-sun-100 px-3 py-1.5 text-sm font-bold text-sun-600">
      <span aria-hidden>🔥</span>
      {t('dashboard.streakDays', { count: streak.currentStreak })}
    </div>
  )
}
