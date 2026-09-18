import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  ScanLine,
  GraduationCap,
  TrendingUp,
  MessageCircleHeart,
  Settings,
  Award,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import {
  fetchContinueLearning,
  fetchSubjectMasterySummary,
  type ContinueLearningItem,
  type SubjectMasterySummary,
} from '@/lib/curriculum/dashboard'
import { recommendNextTopic, type RecommendedTopic } from '@/lib/recommendation/nextTopic'
import { fetchStreak, type StreakInfo } from '@/lib/streak/streak'
import { fetchDailyGoalProgress, type DailyGoalProgress } from '@/lib/gamification/dailyGoal'
import {
  Card,
  LearnerAvatarIcon,
  ProgressRing,
  Badge,
  PageHeader,
  SectionLabel,
  Stagger,
  SkeletonList,
  Skeleton,
  EmptyState,
  ErrorState,
  linkCardClass,
} from '@/components/ui'
import { StreakBadge } from '@/components/dashboard/StreakBadge'
import { PointsBadge } from '@/components/dashboard/PointsBadge'
import { DailyGoalBadge } from '@/components/dashboard/DailyGoalBadge'
import { useAsync } from '@/hooks/useAsync'
import { supabase } from '@/lib/supabase'

interface DashboardData {
  continueItem: ContinueLearningItem | null
  subjects: SubjectMasterySummary[]
  gradeNumber: number | null
  recommended: RecommendedTopic | null
  streak: StreakInfo | null
  dailyGoal: DailyGoalProgress | null
}

export function ChildDashboardPage() {
  const { t } = useTranslation()
  const { activeLearner, learners, setActiveLearnerId } = useLearner()
  const learnerId = activeLearner?.id ?? null

  // One request set, one state. Previously these were five independent
  // `.then(setX)` calls with no catch, so a failure on any of them left that
  // part of the screen permanently blank with no way to retry.
  const { status, data, reload } = useAsync<DashboardData>(
    async () => {
      const learner = activeLearner!
      const [continueItem, subjects, recommended, streak, dailyGoal, gradeRow] = await Promise.all([
        fetchContinueLearning(learner.id, learner.preferred_language),
        fetchSubjectMasterySummary(learner.id, learner.grade_id, learner.preferred_language),
        recommendNextTopic(learner.id, learner.grade_id, learner.preferred_language),
        fetchStreak(learner.id),
        fetchDailyGoalProgress(learner.id, learner.daily_practice_target),
        supabase.from('grades').select('grade_number').eq('id', learner.grade_id).maybeSingle(),
      ])
      return {
        continueItem,
        subjects,
        recommended,
        streak,
        dailyGoal,
        gradeNumber: gradeRow.data?.grade_number ?? null,
      }
    },
    [learnerId],
    { enabled: Boolean(activeLearner) },
  )

  if (!activeLearner) return null

  const loading = status === 'loading' || status === 'idle'

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <PageHeader
        title={t('dashboard.greeting', { name: activeLearner.display_name })}
        subtitle={
          data?.gradeNumber ? t('dashboard.gradeLabel', { grade: data.gradeNumber }) : undefined
        }
        actions={
          <>
            {learners.length > 1 && (
              <select
                className="rounded-xl border-2 border-slate-200 bg-white px-2 py-1.5 text-sm"
                value={activeLearner.id}
                onChange={(e) => setActiveLearnerId(e.target.value)}
                aria-label={t('dashboard.switchLearner')}
              >
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.display_name}
                  </option>
                ))}
              </select>
            )}
            <Link
              to="/parent"
              aria-label={t('dashboard.parentZone')}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-600"
            >
              <Settings size={16} />
            </Link>
          </>
        }
      />

      <div className="mt-4 flex items-center gap-3">
        <LearnerAvatarIcon avatar={activeLearner.avatar} />
        <div className="flex flex-wrap items-center gap-2">
          <PointsBadge totalPoints={activeLearner.total_points} />
          <StreakBadge streak={data?.streak ?? null} />
          <DailyGoalBadge progress={data?.dailyGoal ?? null} />
        </div>
      </div>

      {status === 'error' ? (
        <ErrorState className="mt-6" onRetry={reload} />
      ) : (
        <>
          <div className="mt-6">
            {loading ? (
              <Skeleton className="h-28 w-full rounded-3xl" />
            ) : data?.continueItem ? (
              <Link
                to={`/app/lessons/${data.continueItem.lessonId}`}
                className="card-lift block overflow-hidden rounded-3xl bg-ink-900 p-5 text-white shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-volt-300"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-volt-300">
                  {t('dashboard.continueLearning')}
                </p>
                <p className="font-display mt-1 text-xl font-extrabold">
                  {data.continueItem.topicName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-200">
                  {data.continueItem.subjectName}
                  <ArrowRight size={14} aria-hidden />
                </p>
              </Link>
            ) : (
              <Card tone="volt">
                <p className="text-sm font-medium text-volt-700">{t('dashboard.noProgressYet')}</p>
              </Card>
            )}
          </div>

          <SectionLabel className="mt-8">{t('dashboard.mySubjects')}</SectionLabel>
          {loading ? (
            <SkeletonList className="mt-3" count={2} label={t('common.loading')} />
          ) : data && data.subjects.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {data.subjects.map((s, i) => (
                <Stagger key={s.subjectId} index={i}>
                  <Link
                    to={`/app/subjects/${s.subjectId}`}
                    className={linkCardClass({
                      className: 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 p-3',
                    })}
                  >
                    <ProgressRing value={s.averageMastery} size={40} strokeWidth={4} />
                    <span className="text-xs font-bold break-words text-slate-800">
                      {s.subjectName}
                    </span>
                  </Link>
                </Stagger>
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-3"
              icon={<BookOpen size={22} />}
              title={t('dashboard.emptySubjectsTitle')}
              body={t('dashboard.emptySubjectsBody')}
            />
          )}

          {data?.recommended && (
            <>
              <SectionLabel className="mt-8">{t('dashboard.recommended')}</SectionLabel>
              <Link
                to={`/app/subjects/${data.recommended.subjectId}/topics/${data.recommended.topicId}`}
                className={linkCardClass({
                  className: 'mt-3 flex items-center justify-between gap-3',
                })}
              >
                <div className="min-w-0">
                  <p className="font-display font-bold text-slate-900 break-words">
                    {data.recommended.topicName}
                  </p>
                  <p className="text-sm text-slate-500 break-words">
                    {data.recommended.subjectName} ·{' '}
                    {t(`dashboard.recommendReason.${data.recommended.reason}`)}
                  </p>
                </div>
                <Badge tone="sun">
                  <Sparkles size={12} className="mr-1" aria-hidden />
                  {t('dashboard.recommended')}
                </Badge>
              </Link>
            </>
          )}
        </>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 pb-6">
        <QuickLink to="/app/subjects" icon={BookOpen} label={t('dashboard.mySubjects')} index={0} />
        <QuickLink to="/app/scan" icon={ScanLine} label={t('dashboard.scanWork')} index={1} />
        <QuickLink to="/app/exam" icon={GraduationCap} label={t('dashboard.examPrep')} index={2} />
        <QuickLink to="/app/progress" icon={TrendingUp} label={t('dashboard.myProgress')} index={3} />
        <QuickLink
          to="/app/subjects"
          icon={MessageCircleHeart}
          label={t('dashboard.askTutor')}
          index={4}
          full
        />
        <QuickLink to="/app/achievements" icon={Award} label={t('dashboard.achievements')} index={5} full />
      </div>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
  index,
  full,
}: {
  to: string
  icon: typeof BookOpen
  label: string
  index: number
  full?: boolean
}) {
  return (
    <Stagger index={index} className={full ? 'col-span-2' : undefined}>
      <Link
        to={to}
        className={linkCardClass({
          className: 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 p-3',
        })}
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-volt-50 text-volt-600"
        >
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold break-words text-slate-800">{label}</span>
      </Link>
    </Stagger>
  )
}
