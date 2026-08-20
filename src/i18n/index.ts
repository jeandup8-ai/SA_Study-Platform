import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import af from './locales/af.json'
import { AVAILABLE_LANGUAGES, type LanguageCode } from './languages'

// Only launch-ready languages ship a resource bundle. Enabling a new one from
// `LANGUAGES` in `languages.ts` later is: add its JSON file here, nothing else —
// no schema change, no component change, since every string already flows through t().
export const resources = {
  en: { translation: en },
  af: { translation: af },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'af'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

/**
 * Applies a stored language preference (parent.preferred_language or
 * learner.preferred_language) to the UI. Only switches for languages that
 * actually ship a resource bundle (see AVAILABLE_LANGUAGES) — a preference
 * of e.g. 'zu' is recorded for the future but has no translated strings yet,
 * so switching to it would silently fall back to English text with a
 * mismatched language code, which is worse than staying on the current one.
 */
export function applyLanguagePreference(code: LanguageCode): void {
  if (!AVAILABLE_LANGUAGES.some((l) => l.code === code)) return
  if (i18n.language !== code) void i18n.changeLanguage(code)
}

export default i18n
