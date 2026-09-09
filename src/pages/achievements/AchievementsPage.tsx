import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { BADGE_CATALOG, fetchEarnedBadges, type BadgeCode } from '@/lib/gamification/badges'
import { Card } from '@/components/ui'

export function AchievementsPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const [earned, setEarned] = useState<Set<BadgeCode>>(new Set())

  useEffect(() => {
    if (!activeLearner) return
    fetchEarnedBadges(activeLearner.id).then(setEarned)
  }, [activeLearner])

  if (!activeLearner) return null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('gamification.achievementsTitle')}</h1>
      <p className="text-sm text-slate-500">
        {t('gamification.achievementsSubtitle', { count: earned.size, total: BADGE_CATALOG.length })}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {BADGE_CATALOG.map((badge) => {
          const isEarned = earned.has(badge.code)
          return (
            <Card
              key={badge.code}
              className={`flex flex-col items-center gap-2 py-5 text-center ${isEarned ? '' : 'opacity-40 grayscale'}`}
            >
              <span aria-hidden className="text-4xl">
                {badge.icon}
              </span>
              <p className="text-sm font-bold text-slate-800">{t(`gamification.badge.${badge.code}.name`)}</p>
              <p className="text-xs text-slate-500">{t(`gamification.badge.${badge.code}.description`)}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
