import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, ScanLine, GraduationCap, TrendingUp, MessageCircleHeart } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchContinueLearning, fetchSubjectMasterySummary, type ContinueLearningItem, type SubjectMasterySummary } from '@/lib/curriculum/dashboard'
import { recommendNextTopic, type RecommendedTopic } from '@/lib/recommendation/nextTopic'
import { Card, PressableCard, LearnerAvatarIcon, ProgressRing, Badge } from '@/components/ui'
import { supabase } from '@/lib/supabase'

export function ChildDashboardPage() {
  const { t } = useTranslation()
  const { activeLearner, learners, setActiveLearnerId } = useLearner()
  const [continueItem, setContinueItem] = useState<ContinueLearningItem | null>(null)
  const [subjects, setSubjects] = useState<SubjectMasterySummary[]>([])
  const [gradeNumber, setGradeNumber] = useState<number | null>(null)
  const [recommended, setRecommended] = useState<RecommendedTopic | null>(null)

  useEffect(() => {
    if (!activeLearner) return
    fetchContinueLearning(activeLearner.id, activeLearner.preferred_language).then(setContinueItem)
    fetchSubjectMasterySummary(activeLearner.id, activeLearner.grade_id, activeLearner.preferred_language).then(setSubjects)
    recommendNextTopic(activeLearner.id, activeLearner.grade_id, activeLearner.preferred_language).then(setRecommended)
    supabase
      .from('grades')
      .select('grade_number')
      .eq('id', activeLearner.grade_id)
      .maybeSingle()
      .then(({ data }) => setGradeNumber(data?.grade_number ?? null))
  }, [activeLearner])

  if (!activeLearner) return null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LearnerAvatarIcon avatar={activeLearner.avatar} />
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {t('dashboard.greeting', { name: activeLearner.display_name })}
            </h1>
            {gradeNumber && (
              <p className="text-sm font-medium text-slate-500">
                {t('dashboard.gradeLabel', { grade: gradeNumber })}
              </p>
            )}
          </div>
        </div>
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
      </div>
      <p className="mt-1 text-slate-500">{t('dashboard.prompt')}</p>

      {continueItem ? (
        <Link to={`/app/lessons/${continueItem.lessonId}`} className="mt-6 block">
          <div className="rounded-3xl bg-brand-600 p-5 text-white shadow-md">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-100">
              {t('dashboard.continueLearning')}
            </p>
            <p className="mt-1 text-lg font-bold">{continueItem.lessonTitle}</p>
            <p className="text-sm text-brand-100">
              {continueItem.subjectName} · {continueItem.topicName}
            </p>
          </div>
        </Link>
      ) : (
        <Card className="mt-6 bg-brand-50">
          <p className="text-sm font-medium text-brand-800">{t('dashboard.noProgressYet')}</p>
        </Card>
      )}

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">
        {t('dashboard.mySubjects')}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {subjects.map((s) => (
          <Link key={s.subjectId} to={`/app/subjects/${s.subjectId}`}>
            <Card className="flex items-center gap-3">
              <ProgressRing value={s.averageMastery} size={48} strokeWidth={5} />
              <span className="text-sm font-bold text-slate-800">{s.subjectName}</span>
            </Card>
          </Link>
        ))}
      </div>

      {recommended && (
        <>
          <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">
            {t('dashboard.recommended')}
          </h2>
          <Link to={`/app/subjects/${recommended.subjectId}/topics/${recommended.topicId}`} className="mt-3 block">
            <PressableCard className="flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{recommended.topicName}</p>
                <p className="text-sm text-slate-500">
                  {recommended.subjectName} · {t(`dashboard.recommendReason.${recommended.reason}`)}
                </p>
              </div>
              <Badge tone="sun">{t('dashboard.recommended')}</Badge>
            </PressableCard>
          </Link>
        </>
      )}

      <div className="mt-8 grid grid-cols-2 gap-3 pb-6">
        <QuickLink to="/app/subjects" icon={BookOpen} label={t('dashboard.mySubjects')} />
        <QuickLink to="/app/scan" icon={ScanLine} label={t('dashboard.scanWork')} />
        <QuickLink to="/app/exam" icon={GraduationCap} label={t('dashboard.examPrep')} />
        <QuickLink to="/app/progress" icon={TrendingUp} label={t('dashboard.myProgress')} />
        <QuickLink to="/app/subjects" icon={MessageCircleHeart} label={t('dashboard.askTutor')} full />
      </div>
    </div>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
  full,
}: {
  to: string
  icon: typeof BookOpen
  label: string
  full?: boolean
}) {
  return (
    <Link to={to} className={full ? 'col-span-2' : undefined}>
      <PressableCard className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon size={20} />
        </span>
        <span className="font-semibold text-slate-800">{label}</span>
      </PressableCard>
    </Link>
  )
}
