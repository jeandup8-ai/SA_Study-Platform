import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectMasterySummary, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { fetchWeeklyStats, fetchAttentionNeeded, type WeeklyStats, type TopicAttention } from '@/lib/parent/dashboard'
import { setSubjectBaseline } from '@/lib/parent/subjectBaseline'
import { Card, ProgressRing, Badge, LearnerAvatarIcon, Button } from '@/components/ui'

export function ParentDashboardPage() {
  const { t } = useTranslation()
  const { learners, activeLearner, setActiveLearnerId } = useLearner()
  const [stats, setStats] = useState<WeeklyStats | null>(null)
  const [subjects, setSubjects] = useState<SubjectMasterySummary[]>([])
  const [attention, setAttention] = useState<TopicAttention[]>([])
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingBaseline, setSavingBaseline] = useState(false)

  const loadSubjects = useCallback(() => {
    if (!activeLearner) return
    fetchSubjectMasterySummary(activeLearner.id, activeLearner.grade_id).then(setSubjects)
  }, [activeLearner])

  useEffect(() => {
    if (!activeLearner) return
    fetchWeeklyStats(activeLearner.id).then(setStats)
    loadSubjects()
    fetchAttentionNeeded(activeLearner.id).then(setAttention)
  }, [activeLearner, loadSubjects])

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

  if (learners.length === 0) {
    return (
      <div className="text-center">
        <p className="text-slate-600">No child profiles yet.</p>
        <Link to="/onboarding/learner" className="mt-4 inline-block">
          <Button>{t('parent.addLearner')}</Button>
        </Link>
      </div>
    )
  }

  if (!activeLearner) return null

  const overallMastery =
    subjects.length > 0 ? subjects.reduce((sum, s) => sum + s.averageMastery, 0) / subjects.length : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LearnerAvatarIcon avatar={activeLearner.avatar} />
          <h1 className="text-2xl font-extrabold text-slate-900">
            {t('parent.dashboardTitle', { name: activeLearner.display_name })}
          </h1>
        </div>
        {learners.length > 1 && (
          <select
            className="rounded-xl border-2 border-slate-200 bg-white px-2 py-1.5 text-sm"
            value={activeLearner.id}
            onChange={(e) => setActiveLearnerId(e.target.value)}
          >
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.display_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-400">{t('parent.thisWeek')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={t('parent.lessonsCompleted')} value={String(stats?.lessonsCompleted ?? 0)} />
        <StatTile label={t('parent.questionsAnswered')} value={String(stats?.questionsAnswered ?? 0)} />
        <StatTile label={t('parent.studyTime')} value={formatMinutes(stats?.studySeconds ?? 0)} />
        <Card className="flex flex-col items-center justify-center gap-1">
          <ProgressRing value={overallMastery} size={40} strokeWidth={5} />
          <p className="text-xs font-medium text-slate-500">{t('parent.overallMastery')}</p>
        </Card>
      </div>

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
          </Card>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">
        {t('parent.attentionNeeded')}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {attention.length === 0 && <p className="text-sm text-slate-400">Nothing needs attention right now.</p>}
        {attention.map((a) => (
          <Badge key={a.topicId} tone="warning">
            {a.topicName} · {Math.round(a.masteryScore)}%
          </Badge>
        ))}
      </div>

      {attention.length > 0 && (
        <Card className="mt-4 bg-brand-50">
          <p className="text-sm font-semibold text-brand-800">
            {t('parent.recommended')}: {t('parent.recommendedSessions', { count: 3, minutes: 20 })}
          </p>
        </Card>
      )}

      <p className="mt-8 text-xs text-slate-400">{t('parent.privacyNote')}</p>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </Card>
  )
}

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`
}
