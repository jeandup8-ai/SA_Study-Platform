import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLearner } from '@/context/LearnerContext'
import { fetchActiveCurriculum, fetchLaunchedGrades } from '@/lib/curriculum/queries'
import { AVAILABLE_LANGUAGES } from '@/i18n/languages'
import { Button, Card, LearnerAvatarIcon, AVATAR_OPTIONS } from '@/components/ui'
import type { Curriculum, Grade, LearnerAvatar, LanguageCode } from '@/types/curriculum'

export function CreateLearnerPage() {
  const { t } = useTranslation()
  const { createLearner } = useLearner()
  const navigate = useNavigate()

  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState<LearnerAvatar>('fox')
  const [gradeId, setGradeId] = useState('')
  const [language, setLanguage] = useState<LanguageCode>('en')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchActiveCurriculum().then(async (c) => {
      setCurriculum(c)
      if (c) {
        const g = await fetchLaunchedGrades(c.id)
        setGrades(g)
        if (g.length > 0) setGradeId(g[0].id)
      }
    })
  }, [])

  async function onSubmit() {
    if (!curriculum || !gradeId || !displayName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createLearner({
        displayName: displayName.trim(),
        avatar,
        curriculumId: curriculum.id,
        gradeId,
        preferredLanguage: language,
      })
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-lg">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('onboarding.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('onboarding.minimalDataNote')}</p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t('onboarding.nameLabel')}
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('onboarding.namePlaceholder')}
              maxLength={40}
            />
          </div>

          <div>
            <p className="mb-2 block text-sm font-semibold text-slate-700">
              {t('onboarding.avatarLabel')}
            </p>
            <div className="flex flex-wrap gap-3">
              {AVATAR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatar(option)}
                  aria-label={option}
                  className="rounded-full"
                >
                  <LearnerAvatarIcon avatar={option} selected={avatar === option} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t('onboarding.gradeLabel')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {grades.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGradeId(g.id)}
                  className={`min-h-14 rounded-2xl border-2 font-bold ${
                    gradeId === g.id
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {g.grade_number}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              {t('onboarding.languageLabel')}
            </label>
            <div className="flex gap-2">
              {AVAILABLE_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`min-h-11 flex-1 rounded-xl border-2 font-semibold ${
                    language === lang.code
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm font-medium text-danger-600">{error}</p>}

          <Button
            size="lg"
            className="w-full"
            disabled={!displayName.trim() || !gradeId || submitting}
            onClick={onSubmit}
          >
            {submitting ? t('common.loading') : t('onboarding.createProfile')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
