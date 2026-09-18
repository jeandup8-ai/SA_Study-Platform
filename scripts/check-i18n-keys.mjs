/**
 * Verifies that every marketing i18n key referenced in the source exists in
 * both locales, and that the two locales carry the same key set.
 *
 * A missing key does not crash anything -- i18next just renders the key
 * itself, so `m.hero.titleLine1` ships to a live marketing page looking like
 * a bug. That is exactly the class of mistake a human reviewer skims past,
 * so it gets a machine check instead.
 *
 * Handles two shapes:
 *   t('m.hero.lead')                    -> the key must exist
 *   t(`m.parents.capability.${k}.body`) -> every child of the prefix must
 *                                          carry the suffix
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['en', 'af']
const locales = Object.fromEntries(
  LOCALES.map((code) => [code, JSON.parse(readFileSync(`src/i18n/locales/${code}.json`, 'utf8'))]),
)

function walkFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walkFiles(path)
    return /\.tsx?$/.test(path) ? [path] : []
  })
}

function lookup(bundle, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), bundle)
}

const sources = walkFiles('src').map((path) => ({ path, text: readFileSync(path, 'utf8') }))
const problems = []

// --- static keys ---------------------------------------------------------
const staticKeys = new Set()
for (const { text } of sources) {
  // Any 'm.…' literal, so keys held in const tables are checked too.
  for (const match of text.matchAll(/'(m\.[A-Za-z0-9_.]+)'/g)) staticKeys.add(match[1])
}
for (const key of [...staticKeys].sort()) {
  for (const code of LOCALES) {
    const value = lookup(locales[code], key)
    // Plurals live as `${key}_one` / `${key}_other`, so accept either form.
    const plural = lookup(locales[code], `${key}_other`)
    if (typeof value !== 'string' && typeof plural !== 'string') {
      problems.push(`[${code}] missing key: ${key}`)
    }
  }
}

// --- templated keys ------------------------------------------------------
const patterns = new Set()
for (const { text } of sources) {
  for (const match of text.matchAll(/`(m\.[A-Za-z0-9_.]*)\$\{[^}]+\}([A-Za-z0-9_.]*)`/g)) {
    patterns.add(`${match[1]}|${match[2]}`)
  }
}
for (const pattern of [...patterns].sort()) {
  const [rawPrefix, rawSuffix] = pattern.split('|')
  const prefix = rawPrefix.replace(/\.$/, '')
  const suffix = rawSuffix.replace(/^\./, '')
  for (const code of LOCALES) {
    // A bare `m.${x}` prefix carries the whole sub-path in the variable, so
    // there is nothing structural to enumerate. Those keys are caught by the
    // static scan above instead.
    if (prefix === 'm') continue
    const node = lookup(locales[code], prefix)
    if (node == null || typeof node !== 'object') {
      problems.push(`[${code}] templated prefix is not an object: ${prefix}`)
      continue
    }
    for (const child of Object.keys(node)) {
      const full = suffix ? `${prefix}.${child}.${suffix}` : `${prefix}.${child}`
      const value = lookup(locales[code], full)
      const plural = lookup(locales[code], `${full}_other`)
      if (typeof value !== 'string' && typeof plural !== 'string') {
        problems.push(`[${code}] missing templated key: ${full}`)
      }
    }
  }
}

// --- locale parity -------------------------------------------------------
function flatten(node, prefix = '') {
  if (typeof node === 'string') return [prefix]
  if (node == null || typeof node !== 'object') return []
  return Object.entries(node).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  )
}
// Parity is checked across the WHOLE locale file, not just the marketing
// namespace. The app is bilingual end to end, and an English-only string
// reaching an Afrikaans learner is the same defect wherever it lives --
// i18next silently falls back to the key or to English, so nothing fails
// loudly at runtime to tell us about it.
const enKeys = new Set(flatten(locales.en))
const afKeys = new Set(flatten(locales.af))
for (const key of enKeys) if (!afKeys.has(key)) problems.push(`[af] not translated: ${key}`)
for (const key of afKeys) if (!enKeys.has(key)) problems.push(`[en] extra key: ${key}`)

if (problems.length > 0) {
  console.error(`i18n check failed (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(
  `i18n ok: ${staticKeys.size} static keys, ${patterns.size} templated patterns, ${enKeys.size} keys per locale`,
)
