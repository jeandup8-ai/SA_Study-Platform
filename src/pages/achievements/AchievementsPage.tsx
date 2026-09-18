import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { BADGE_CATALOG, fetchEarnedBadges, type BadgeCode } from '@/lib/gamification/badges'
import { Card, PageHeader, Stagger, Skeleton, ErrorState } from '@/components/ui'
import { useAsync } from '@/hooks/useAsync'

export function AchievementsPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const learnerId = activeLearner?.id ?? null

  const { status, data, reload } = useAsync<Set<BadgeCode>>(
    () => fetchEarnedBadges(activeLearner!.id),
    [learnerId],
    { enabled: Boolean(activeLearner) },
  )

  if (!activeLearner) return null

  const earned = data ?? new Set<BadgeCode>()
  const loading = status === 'loading' || status === 'idle'

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <PageHeader
        eyebrow={t('nav.dashboard')}
        title={t('gamification.achievementsTitle')}
        subtitle={t('gamification.achievementsSubtitle', {
          count: earned.size,
          total: BADGE_CATALOG.length,
        })}
      />

      {status === 'error' ? (
        <ErrorState className="mt-4" onRetry={reload} />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {BADGE_CATALOG.map((badge, i) => {
            const isEarned = earned.has(badge.code)
            return (
              <Stagger key={badge.code} index={i}>
                <Card
                  tone={isEarned ? 'gold' : 'plain'}
                  className={`flex h-full flex-col items-center gap-2 py-5 text-center ${
                    loading || isEarned ? '' : 'opacity-45 grayscale'
                  }`}
                >
                  {loading ? (
                    <Skeleton className="h-10 w-10 rounded-full" />
                  ) : (
                    <span aria-hidden className="text-4xl">
                      {badge.icon}
                    </span>
                  )}
                  <p className="font-display text-sm font-bold text-slate-800">
                    {t(`gamification.badge.${badge.code}.name`)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(`gamification.badge.${badge.code}.description`)}
                  </p>
                </Card>
              </Stagger>
            )
          })}
        </div>
      )}
    </div>
  )
}
