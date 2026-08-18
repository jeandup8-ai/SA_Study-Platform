import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import af from './locales/af.json'

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

export default i18n
