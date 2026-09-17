import { useTranslation } from 'react-i18next'

/**
 * Public pages have no learner record to read `preferred_language` from, so
 * the visitor picks directly. i18next persists the choice to localStorage,
 * which is also what the signed-in app reads.
 */
export function PracticeLanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('af') ? 'af' : 'en'

  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1" role="group">
      {(['en', 'af'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={current === code}
          onClick={() => void i18n.changeLanguage(code)}
          className={`min-h-9 rounded-full px-4 text-sm font-bold ${
            current === code ? 'bg-brand-600 text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {code === 'en' ? 'English' : 'Afrikaans'}
        </button>
      ))}
    </div>
  )
}
