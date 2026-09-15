import { useTranslation } from 'react-i18next'
import type { DailyGoalProgress } from '@/lib/gamification/dailyGoal'

export function DailyGoalBadge({ progress }: { progress: DailyGoalProgress | null }) {
  const { t } = useTranslation()
  if (!progress) return null

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
        progress.met ? 'bg-success-50 text-success-600' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span aria-hidden>{progress.met ? '✅' : '🎯'}</span>
      {t('dashboard.dailyGoalProgress', { done: progress.activitiesToday, target: progress.target })}
    </div>
  )
}
