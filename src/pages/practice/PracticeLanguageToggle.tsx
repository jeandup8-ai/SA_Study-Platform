import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/**
 * Public pages have no learner record to read `preferred_language` from, so
 * the visitor picks directly. i18next persists the choice to localStorage,
 * which is also what the signed-in app reads.
 *
 * `tone` matches the surface it sits on -- these now live in the ink hero
 * band rather than on white.
 */
export function PracticeLanguageToggle({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('af') ? 'af' : 'en'

  return (
    <div
      className={clsx(
        'inline-flex rounded-full border p-1',
        tone === 'dark' ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white',
      )}
      role="group"
    >
      {(['en', 'af'] as const).map((code) => {
        const active = current === code
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => void i18n.changeLanguage(code)}
            className={clsx(
              'min-h-9 rounded-full px-4 text-sm font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400',
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
