/**
 * The 11 official South African languages. This list — and every learner/lesson/question
 * row in the database — is keyed by these codes from day one, so adding a language later
 * is a content/translation job, never a schema or architecture change.
 *
 * `available` gates what the UI lets a parent/learner actually select today. Only English
 * and Afrikaans ship with real, human-reviewed translations at launch; the rest are wired
 * into the type system and locale-file structure now (English-fallback content) so they can
 * be turned on the moment verified translations land, with no rebuild.
 */
export interface LanguageDefinition {
  code: LanguageCode
  englishName: string
  nativeName: string
  available: boolean
}

export type LanguageCode = 'en' | 'af' | 'zu' | 'xh' | 'nr' | 'nso' | 'st' | 'tn' | 'ss' | 've' | 'ts'

export const LANGUAGES: LanguageDefinition[] = [
  { code: 'en', englishName: 'English', nativeName: 'English', available: true },
  { code: 'af', englishName: 'Afrikaans', nativeName: 'Afrikaans', available: true },
  { code: 'zu', englishName: 'isiZulu', nativeName: 'isiZulu', available: false },
  { code: 'xh', englishName: 'isiXhosa', nativeName: 'isiXhosa', available: false },
  { code: 'nr', englishName: 'isiNdebele', nativeName: 'isiNdebele', available: false },
  { code: 'nso', englishName: 'Sepedi', nativeName: 'Sepedi', available: false },
  { code: 'st', englishName: 'Sesotho', nativeName: 'Sesotho', available: false },
  { code: 'tn', englishName: 'Setswana', nativeName: 'Setswana', available: false },
  { code: 'ss', englishName: 'siSwati', nativeName: 'siSwati', available: false },
  { code: 've', englishName: 'Tshivenda', nativeName: 'Tshivenda', available: false },
  { code: 'ts', englishName: 'Xitsonga', nativeName: 'Xitsonga', available: false },
]

export const AVAILABLE_LANGUAGES = LANGUAGES.filter((l) => l.available)

export function languageName(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.englishName ?? code
}
