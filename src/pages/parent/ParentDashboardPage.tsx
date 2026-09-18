import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil, ChevronDown, ChevronUp, BookOpenCheck, ListChecks, Clock, UserPlus, ShieldCheck } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectMasterySummary, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { fetchTopicsWithProgress, type TopicWithProgress } from '@/lib/curriculum/topics'
import { fetchWeeklyStats, fetchAttentionNeeded, type WeeklyStats, type TopicAttention } from '@/lib/parent/dashboard'
import { setSubjectBaseline } from '@/lib/parent/subjectBaseline'
import { setTopicBaseline } from '@/lib/parent/topicBaseline'
import { fetchDailyGoalProgress, updateDailyTarget, type DailyGoalProgress } from '@/lib/gamification/dailyGoal'
import {
  Card,
  ProgressRing,
  Badge,
  LearnerAvatarIcon,
  Button,
  PageHeader,
  SectionLabel,
  StatTile,
  EmptyState,
} from '@/components/ui'
import { Trophy } from 'lucide-react'

export function ParentDashboardPage() {
  const { t } = useTranslation()
  const { learners, activeLearner, setActiveLearnerId, refreshLearners } = useLearner()
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [dailyGoal, setDailyGoal] = useState<DailyGoalProgress | null>(null)
  const [editingDailyTarget, setEditingDailyTarget] = useState(false)
  const [dailyTargetValue, setDailyTargetValue] = useState('')
  const [savingDailyTarget, setSavingDailyTarget] = useState(false)
  const [subjects, setSubjects] = useState<SubjectMasterySummary[]>([])
  const [attention, setAttention] = useState<TopicAttention[]>([])
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingBaseline, setSavingBaseline] = useState(false)
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, TopicWithProgress[]>>({})
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)
  const [topicEditValue, setTopicEditValue] = useState('')
  const [savingTopicBaseline, setSavingTopicBaseline] = useState(false)

  const loadSubjects = useCallback(() => {
    if (!activeLearner) return
    fetchSubjectMasterySummary(activeLearner.id, activeLearner.grade_id).then(setSubjects)
  }, [activeLearner])

  const loadTopicsForSubject = useCallback(
    (subjectId: string) => {
      if (!activeLearner) return
      fetchTopicsWithProgress(subjectId, activeLearner.grade_id, activeLearner.id, activeLearner.preferred_language).then(
        (topics) => setTopicsBySubject((prev) => ({ ...prev, [subjectId]: topics })),
      )
    },
    [activeLearner],
  )

  useEffect(() => {
    if (!activeLearner) return
    fetchWeeklyStats(activeLearner.id).then(setStats)
    loadSubjects()
    fetchAttentionNeeded(activeLearner.id).then(setAttention)
    fetchDailyGoalProgress(activeLearner.id, activeLearner.daily_practice_target).then(setDailyGoal)
  }, [activeLearner, loadSubjects])

  async function saveDailyTarget() {
    if (!activeLearner) return
    const target = Number(dailyTargetValue)
    if (!Number.isFinite(target) || target < 1) return
    setSavingDailyTarget(true)
    await updateDailyTarget(activeLearner.id, target)
    await refreshLearners()
    setDailyGoal(await fetchDailyGoalProgress(activeLearner.id, target))
    setSavingDailyTarget(false)
    setEditingDailyTarget(false)
  }

  function startEditingBaseline(subject: SubjectMasterySummary) {
    setEditingSubjectId(subject.subjectId)
    setEditValue(subject.isBaseline ? String(Math.round(subject.averageMastery)) : '')
  }

  async function saveBaseline(subjectId: string) {
    if (!activeLearner) return
    const percent = Math.max(0, Math.min(100, Number(editValue)))
    if (Number.isNaN(percent)) return
    setSavingBaseline(true)
    await setSubjectBaseline(activeLearner.id, subjectId, percent)
    setSavingBaseline(false)
    setEditingSubjectId(null)
    loadSubjects()
  }

  function toggleTopicBreakdown(subjectId: string) {
    if (expandedSubjectId === subjectId) {
      setExpandedSubjectId(null)
      return
    }
    setExpandedSubjectId(subjectId)
    if (!topicsBySubject[subjectId]) loadTopicsForSubject(subjectId)
  }

  function startEditingTopicBaseline(topic: TopicWithProgress) {
    setEditingTopicId(topic.id)
    setTopicEditValue(topic.isBaseline ? String(Math.round(topic.masteryScore)) : '')
  }

  async function saveTopicBaseline(subjectId: string, topicId: string) {
    if (!activeLearner) return
    const percent = Math.max(0, Math.min(100, Number(topicEditValue)))
    if (Number.isNaN(percent)) return
    setSavingTopicBaseline(true)
    await setTopicBaseline(activeLearner.id, topicId, percent)
    setSavingTopicBaseline(false)
    setEditingTopicId(null)
    loadTopicsForSubject(subjectId)
  }

  if (learners.length === 0) {
    return (
      <EmptyState
        icon={<UserPlus size={22} />}
        title={t('parent.noLearnersYet')}
        action={
          <Link to="/onboarding/learner">
            <Button size="md">{t('parent.addLearner')}</Button>
          </Link>
        }
      />
    )
  }

  if (!activeLearner) return null

  const overallMastery =
    subjects.length > 0 ? subjects.reduce((sum, s) => sum + s.averageMastery, 0) / subjects.length : 0

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.parent')}
        title={
          <span className="flex items-center gap-3">
            <LearnerAvatarIcon avatar={activeLearner.avatar} />
            {t('parent.dashboardTitle', { name: activeLearner.display_name })}
          </span>
        }
        actions={
          learners.length > 1 ? (
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
          ) : undefined
        }
      />

      {learners.length > 1 && (
        <Card className="mt-6">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-gold-500" />
            <p className="font-display text-sm font-bold text-slate-800">
              {t('parent.familyLeaderboard')}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {[...learners]
              .sort((a, b) => b.total_points - a.total_points)
              .map((l, i) => (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <LearnerAvatarIcon avatar={l.avatar} />
                  <span className="flex-1 text-sm font-semibold text-slate-700">{l.display_name}</span>
                  <span className="text-sm font-bold text-brand-700">
                    {t('gamification.totalPoints', { count: l.total_points })}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <SectionLabel className="mt-6">{t('parent.thisWeek')}</SectionLabel>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          icon={<BookOpenCheck size={16} />}
          tone="brand"
          label={t('parent.lessonsCompleted')}
          value={stats?.lessonsCompleted ?? 0}
        />
        <StatTile
          icon={<ListChecks size={16} />}
          tone="volt"
          label={t('parent.questionsAnswered')}
          value={stats?.questionsAnswered ?? 0}
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="lilac"
          label={t('parent.studyTime')}
          value={formatMinutes(stats?.studySeconds ?? 0)}
        />
        <Card className="flex flex-col items-center justify-center gap-1">
          <ProgressRing value={overallMastery} size={40} strokeWidth={5} />
          <p className="text-xs font-medium text-slate-500">{t('parent.overallMastery')}</p>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm font-bold text-slate-800">{t('parent.dailyGoalTitle')}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {dailyGoal
                ? t('dashboard.dailyGoalProgress', { done: dailyGoal.activitiesToday, target: dailyGoal.target })
                : t('common.loading')}
            </p>
          </div>
          {!editingDailyTarget && (
            <button
              onClick={() => {
                setEditingDailyTarget(true)
                setDailyTargetValue(String(activeLearner.daily_practice_target))
              }}
              aria-label={t('parent.editDailyGoal')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
        {editingDailyTarget && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <label className="text-sm font-medium text-slate-600">{t('parent.dailyGoalLabel')}</label>
            <input
              type="number"
              min={1}
              value={dailyTargetValue}
              onChange={(e) => setDailyTargetValue(e.target.value)}
              className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm"
            />
            <Button size="md" className="ml-auto" disabled={savingDailyTarget || dailyTargetValue === ''} onClick={() => void saveDailyTarget()}>
              {t('common.save')}
            </Button>
            <Button size="md" variant="ghost" onClick={() => setEditingDailyTarget(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </Card>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">
        {t('parent.subjectsBreakdown')}
      </h2>
      <div className="mt-3 space-y-2">
        {subjects.map((s) => (
          <Card key={s.subjectId}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{s.subjectName}</p>
                {s.isBaseline && (
                  <div className="mt-1">
                    <Badge tone="neutral">{t('parent.startingPointBadge')}</Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:w-32">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${s.averageMastery}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-bold text-slate-600">
                  {Math.round(s.averageMastery)}%
                </span>
                {editingSubjectId !== s.subjectId && (
                  <button
                    onClick={() => startEditingBaseline(s)}
                    aria-label={t('parent.setStartingPoint')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                <button
                  onClick={() => toggleTopicBreakdown(s.subjectId)}
                  aria-label={t('parent.byTopicToggle')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  {expandedSubjectId === s.subjectId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>
            </div>

            {editingSubjectId === s.subjectId && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">{t('parent.startingPointHint')}</p>
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">{t('parent.startingPointLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <Button
                    size="md"
                    className="ml-auto"
                    disabled={savingBaseline || editValue === ''}
                    onClick={() => void saveBaseline(s.subjectId)}
                  >
                    {t('common.save')}
                  </Button>
                  <Button size="md" variant="ghost" onClick={() => setEditingSubjectId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}

            {expandedSubjectId === s.subjectId && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">{t('parent.byTopicHint')}</p>
                {(topicsBySubject[s.subjectId] ?? []).map((topic) => (
                  <div key={topic.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-700">{topic.name}</p>
                        {topic.isBaseline && (
                          <Badge tone="neutral">{t('parent.startingPointBadge')}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-600">{Math.round(topic.masteryScore)}%</span>
                        {editingTopicId !== topic.id && (
                          <button
                            onClick={() => startEditingTopicBaseline(topic)}
                            aria-label={t('parent.setStartingPoint')}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingTopicId === topic.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={topicEditValue}
                          onChange={(e) => setTopicEditValue(e.target.value)}
                          className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-slate-500">%</span>
                        <Button
                          size="md"
                          className="ml-auto"
                          disabled={savingTopicBaseline || topicEditValue === ''}
                          onClick={() => void saveTopicBaseline(s.subjectId, topic.id)}
                        >
                          {t('common.save')}
                        </Button>
                        <Button size="md" variant="ghost" onClick={() => setEditingTopicId(null)}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {(topicsBySubject[s.subjectId]?.length ?? 0) === 0 && (
                  <p className="text-xs text-slate-400">{t('subjects.noTopicsYet')}</p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <SectionLabel className="mt-8">{t('parent.attentionNeeded')}</SectionLabel>
      <div className="mt-3 flex flex-wrap gap-2">
        {attention.length === 0 && <p className="text-sm text-slate-400">{t('parent.noAttentionNeeded')}</p>}
        {attention.map((a) => (
          <Badge key={a.topicId} tone="warning">
            {a.topicName} · {Math.round(a.masteryScore)}%
          </Badge>
        ))}
      </div>

      {attention.length > 0 && (
        <Card tone="volt" className="mt-4">
          <p className="text-sm font-semibold text-volt-700">
            {t('parent.recommended')}: {t('parent.recommendedSessions', { count: 3, minutes: 20 })}
          </p>
        </Card>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={13} aria-hidden />
        {t('parent.privacyNote')}
      </p>
    </div>
  )
}

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`
}
