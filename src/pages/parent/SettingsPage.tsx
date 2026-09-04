import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { fetchWeeklyDigestEnabled, setWeeklyDigestEnabled } from '@/lib/parent/emailPreferences'
import { Card } from '@/components/ui'

export function SettingsPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const [digestEnabled, setDigestEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

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
    </div>
  )
}
