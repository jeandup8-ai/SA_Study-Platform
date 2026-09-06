import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchSubjectsForGrade, fetchTopicsForSubjectAndGrade } from '@/lib/curriculum/queries'
import { setSubjectBaselines } from '@/lib/parent/subjectBaseline'
import { setTopicBaselines } from '@/lib/parent/topicBaseline'
import { Button, Card } from '@/components/ui'
import type { Subject, Topic } from '@/types/curriculum'

export function StartingPointPage() {
  const { t } = useTranslation()
  const { activeLearner } = useLearner()
  const navigate = useNavigate()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectPercents, setSubjectPercents] = useState<Record<string, string>>({})
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null)
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, Topic[]>>({})
  const [topicPercents, setTopicPercents] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!activeLearner) return
    fetchSubjectsForGrade(activeLearner.grade_id, activeLearner.preferred_language).then(setSubjects)
  }, [activeLearner])

  async function toggleExpanded(subjectId: string) {
    if (expandedSubjectId === subjectId) {
      setExpandedSubjectId(null)
      return
    }
    setExpandedSubjectId(subjectId)
    if (!activeLearner || topicsBySubject[subjectId]) return
    const topics = await fetchTopicsForSubjectAndGrade(subjectId, activeLearner.grade_id, activeLearner.preferred_language)
    setTopicsBySubject((prev) => ({ ...prev, [subjectId]: topics }))
  }

  async function onSubmit() {
    if (!activeLearner) return
    setSubmitting(true)
    try {
      const subjectEntries = Object.entries(subjectPercents)
        .filter(([, value]) => value !== '')
        .map(([subjectId, value]) => ({ subjectId, baselineMastery: clampPercent(value) }))
      const topicEntries = Object.entries(topicPercents)
        .filter(([, value]) => value !== '')
        .map(([topicId, value]) => ({ topicId, baselineMastery: clampPercent(value) }))
      await setSubjectBaselines(activeLearner.id, subjectEntries)
      await setTopicBaselines(activeLearner.id, topicEntries)
    } finally {
      setSubmitting(false)
      navigate('/app')
    }
  }

  const hasAnyInput =
    Object.values(subjectPercents).some((v) => v !== '') || Object.values(topicPercents).some((v) => v !== '')

  if (!activeLearner) return null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('onboarding.startingPointTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('onboarding.startingPointIntro')}</p>

        <div className="mt-6 space-y-3">
          {subjects.map((subject) => (
            <Card key={subject.id} className="bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-800">{subject.name}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="—"
                    value={subjectPercents[subject.id] ?? ''}
                    onChange={(e) =>
                      setSubjectPercents((prev) => ({ ...prev, [subject.id]: e.target.value }))
                    }
                    className="w-16 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <button
                    type="button"
                    onClick={() => void toggleExpanded(subject.id)}
                    aria-label={t('onboarding.byTopicToggle')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    {expandedSubjectId === subject.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {expandedSubjectId === subject.id && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <p className="text-xs text-slate-500">{t('onboarding.byTopicHint')}</p>
                  {(topicsBySubject[subject.id] ?? []).map((topic) => (
                    <div key={topic.id} className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">{topic.name}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder={subjectPercents[subject.id] || '—'}
                          value={topicPercents[topic.id] ?? ''}
                          onChange={(e) =>
                            setTopicPercents((prev) => ({ ...prev, [topic.id]: e.target.value }))
                          }
                          className="w-16 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    </div>
                  ))}
                  {topicsBySubject[subject.id]?.length === 0 && (
                    <p className="text-xs text-slate-400">{t('subjects.noTopicsYet')}</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button size="lg" className="flex-1" disabled={submitting} onClick={() => void onSubmit()}>
            {submitting
              ? t('common.loading')
              : hasAnyInput
                ? t('onboarding.saveStartingPoint')
                : t('onboarding.skipStartingPoint')}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function clampPercent(value: string): number {
  return Math.max(0, Math.min(100, Number(value)))
}
