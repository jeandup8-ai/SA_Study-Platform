import { useTranslation } from 'react-i18next'
import type { BadgeCode } from '@/lib/gamification/badges'
import { BADGE_CATALOG } from '@/lib/gamification/badges'

export function PointsEarnedBanner({ points, newBadges }: { points: number; newBadges: BadgeCode[] }) {
  const { t } = useTranslation()
  if (points <= 0 && newBadges.length === 0) return null

  return (
    <div className="mt-1 flex flex-col items-center gap-2">
      {points > 0 && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sun-100 px-4 py-1.5 text-sm font-bold text-sun-600">
          <span aria-hidden>⭐</span>
          {t('gamification.pointsEarned', { count: points })}
        </div>
      )}
      {newBadges.map((code) => {
        const icon = BADGE_CATALOG.find((b) => b.code === code)?.icon ?? '🏅'
        return (
          <div
            key={code}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-brand-100 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700"
          >
            <span aria-hidden className="text-lg">
              {icon}
            </span>
            {t('gamification.newBadge')}: {t(`gamification.badge.${code}.name`)}
          </div>
        )
      })}
    </div>
  )
}
