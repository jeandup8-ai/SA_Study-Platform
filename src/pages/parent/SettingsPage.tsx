import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLearner } from '@/context/LearnerContext'
import { fetchWeeklyDigestEnabled, setWeeklyDigestEnabled } from '@/lib/parent/emailPreferences'
import { Button, Card, LearnerAvatarIcon } from '@/components/ui'

export function SettingsPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const { learners, deleteLearner } = useLearner()
  const [digestEnabled, setDigestEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeFailed, setRemoveFailed] = useState(false)

  useEffect(() => {
    if (!parent) return
    fetchWeeklyDigestEnabled(parent.id).then(setDigestEnabled)
  }, [parent])

  async function onToggle(next: boolean) {
    if (!parent) return
    setSaving(true)
    setSaveFailed(false)
    // Optimistic, then reverted on failure — a preference toggle that silently
    // lies about having saved is worse than one that visibly fails.
    setDigestEnabled(next)
    const ok = await setWeeklyDigestEnabled(parent.id, next)
    if (!ok) {
      setDigestEnabled(!next)
      setSaveFailed(true)
    }
    setSaving(false)
  }

  async function onConfirmRemove(id: string) {
    setRemovingId(id)
    setRemoveFailed(false)
    try {
      await deleteLearner(id)
      setConfirmingId(null)
    } catch {
      setRemoveFailed(true)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold text-slate-900">{t('parent.settingsTitle')}</h1>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-slate-900">{t('parent.weeklyEmailTitle')}</p>
            <p className="mt-1 text-sm text-slate-600">{t('parent.weeklyEmailBody')}</p>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={digestEnabled ?? true}
              disabled={digestEnabled === null || saving}
              onChange={(e) => void onToggle(e.target.checked)}
              aria-label={t('parent.weeklyEmailTitle')}
            />
            <div className="h-7 w-12 rounded-full bg-slate-300 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-disabled:opacity-50" />
          </label>
        </div>
        {saveFailed && <p className="mt-3 text-sm font-medium text-danger-600">{t('parent.settingsSaveFailed')}</p>}
      </Card>

      <p className="mt-4 text-xs text-slate-400">{t('parent.essentialEmailsNote')}</p>

      <Card className="mt-6">
        <p className="font-bold text-slate-900">{t('parent.manageLearners')}</p>
        <div className="mt-3 space-y-2">
          {learners.map((l) => (
            <div key={l.id} className="rounded-2xl border-2 border-slate-200 p-3">
              {confirmingId === l.id ? (
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {t('parent.removeLearnerConfirm', { name: l.display_name })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="md"
                      variant="danger"
                      disabled={removingId === l.id}
                      onClick={() => void onConfirmRemove(l.id)}
                    >
                      {removingId === l.id ? t('common.loading') : t('parent.removeLearnerConfirmButton')}
                    </Button>
                    <Button
                      size="md"
                      variant="ghost"
                      disabled={removingId === l.id}
                      onClick={() => setConfirmingId(null)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <LearnerAvatarIcon avatar={l.avatar} />
                    <span className="font-semibold text-slate-800">{l.display_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(l.id)}
                    className="flex items-center gap-1 rounded-xl px-2 py-1 text-sm font-semibold text-danger-600 hover:bg-danger-50"
                  >
                    <Trash2 size={16} aria-hidden />
                    {t('parent.removeLearner')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {removeFailed && <p className="mt-3 text-sm font-medium text-danger-600">{t('parent.removeLearnerFailed')}</p>}
      </Card>
    </div>
  )
}
