import { useTranslation } from 'react-i18next'

export function PointsBadge({ totalPoints }: { totalPoints: number }) {
  const { t } = useTranslation()
  if (totalPoints <= 0) return null

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-bold text-brand-700">
      <span aria-hidden>⭐</span>
      {t('gamification.totalPoints', { count: totalPoints })}
    </div>
  )
}
