/**
 * Regenerates public/sitemap.xml from the database at build time.
 *
 * The free practice section grows every time a test is published, and a
 * hand-maintained sitemap would be stale within a week. Static marketing URLs
 * stay hard-coded here; everything under /practice is enumerated live.
 *
 * Runs as a `prebuild` step. If Supabase credentials are absent (a local
 * `npm run build` without a .env, for example) it leaves the committed sitemap
 * untouched rather than truncating it to the static URLs.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SITE_URL = 'https://studylegends.co.za'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml')

const STATIC_URLS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/practice', changefreq: 'daily', priority: '0.9' },
  { loc: '/pricing', changefreq: 'monthly', priority: '0.8' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
  { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'monthly', priority: '0.3' },
  { loc: '/refund-policy', changefreq: 'monthly', priority: '0.3' },
  { loc: '/subscription-cancellation', changefreq: 'monthly', priority: '0.3' },
]

function xmlEscape(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function render(urls) {
  const body = urls
    .map(
      ({ loc, changefreq, priority }) =>
        `  <url>\n    <loc>${xmlEscape(SITE_URL + loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.warn('[sitemap] VITE_SUPABASE_* not set — keeping the committed sitemap.xml')
  process.exit(0)
}

const supabase = createClient(url, key)
const { data, error } = await supabase
  .from('practice_tests')
  .select('slug, grades ( grade_number ), subjects ( slug )')
  .eq('is_published', true)

if (error) {
  // A build must not fail because the sitemap could not be refreshed.
  console.warn(`[sitemap] query failed (${error.message}) — keeping the committed sitemap.xml`)
  process.exit(0)
}

const practiceUrls = []
const seenGrades = new Set()
const seenSubjects = new Set()

for (const row of data ?? []) {
  const grade = row.grades?.grade_number
  const subject = row.subjects?.slug
  if (grade == null || !subject) continue

  if (!seenGrades.has(grade)) {
    seenGrades.add(grade)
    practiceUrls.push({ loc: `/practice/grade-${grade}`, changefreq: 'weekly', priority: '0.8' })
  }
  const subjectKey = `${grade}/${subject}`
  if (!seenSubjects.has(subjectKey)) {
    seenSubjects.add(subjectKey)
    practiceUrls.push({ loc: `/practice/grade-${grade}/${subject}`, changefreq: 'weekly', priority: '0.8' })
  }
  practiceUrls.push({
    loc: `/practice/grade-${grade}/${subject}/${row.slug}`,
    changefreq: 'monthly',
    priority: '0.7',
  })
}

practiceUrls.sort((a, b) => a.loc.localeCompare(b.loc))

const xml = render([...STATIC_URLS, ...practiceUrls])
const previous = (() => {
  try {
    return readFileSync(OUT, 'utf8')
  } catch {
    return ''
  }
})()

if (xml !== previous) writeFileSync(OUT, xml)
console.log(`[sitemap] ${STATIC_URLS.length + practiceUrls.length} URLs (${practiceUrls.length} practice)`)
