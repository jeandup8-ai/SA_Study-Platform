import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useLearner } from '@/context/LearnerContext'
import type { LanguageCode } from '@/types/curriculum'

/**
 * English / Afrikaans switch, for every surface that has one.
 *
 * Until now the only way to change language anywhere in StudyLegends was
 * the toggle on the free /practice pages. A visitor reading the Afrikaans
 * marketing copy could not switch to it, a parent could not switch at all,
 * and a child's language was fixed at whatever was picked when their
 * profile was created -- with no way to change it short of deleting the
 * child and starting again. For a product sold into both language
 * communities that is not a preference, it is a wall.
 *
 * When a learner is active the choice is written to their
 * preferred_language, because that column -- not i18next -- is what every
 * content query reads, and LearnerProvider forces the interface back to it
 * whenever the active learner changes. Switching only the interface would
 * give Afrikaans menus around English lessons and would snap back on the
 * next profile switch. With no learner (a visitor, or a parent before
 * adding a child) there is nothing to write to and i18next alone is right.
 *
 * `tone` exists because this sits on the dark marketing band and on the
 * light parent and child app, and there is no tailwind-merge in this
 * project -- conflicting utilities would resolve unpredictably, so each
 * tone spells out its own full set.
 */
export function LanguageToggle({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light'
  className?: string
}) {
  const { i18n, t } = useTranslation()
  const { activeLearner, setLearnerLanguage } = useLearner()
  const [saving, setSaving] = useState(false)
  const current: LanguageCode = i18n.language.startsWith('af') ? 'af' : 'en'

  async function choose(code: LanguageCode) {
    if (code === current || saving) return
    setSaving(true)
    try {
      // The interface moves first either way, so the tap feels immediate.
      // With a learner, the write-through then re-applies the same value.
      await i18n.changeLanguage(code)
      if (activeLearner) await setLearnerLanguage(code)
    } catch {
      // The write failed, so the stored preference still says otherwise and
      // the next learner refresh would snap the interface back. Undo now
      // rather than leave the two disagreeing.
      await i18n.changeLanguage(current)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="group"
      aria-label={t('common.languageLabel')}
      className={clsx(
        'inline-flex rounded-full border p-1',
        tone === 'dark' ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white',
        className,
      )}
    >
      {(['en', 'af'] as const).map((code) => {
        const active = current === code
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            disabled={saving}
            onClick={() => void choose(code)}
            className={clsx(
              'min-h-11 rounded-full px-4 text-sm font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400',
              saving && 'opacity-60',
              active
                ? 'bg-volt-500 text-ink-950'
                : tone === 'dark'
                  ? 'text-ink-200 hover:text-white'
                  : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {code === 'en' ? 'English' : 'Afrikaans'}
          </button>
        )
      })}
    </div>
  )
}
