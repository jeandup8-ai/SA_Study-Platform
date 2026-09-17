import { useEffect } from 'react'

const SITE_URL = 'https://studylegends.co.za'

/** The values index.html ships with, restored whenever a page that overrode
 * them unmounts -- otherwise a visitor who opens a practice test and then
 * navigates home keeps the test's title and description. */
const DEFAULTS = {
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? `${SITE_URL}/`,
}

export interface SeoOptions {
  title: string
  description: string
  /** Path only, e.g. `/practice/grade-5/mathematics`. */
  path: string
  /** Rendered into a <script type="application/ld+json"> for rich results. */
  structuredData?: Record<string, unknown>
  noIndex?: boolean
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.rel = 'canonical'
    document.head.appendChild(element)
  }
  element.href = href
}

/**
 * Per-page metadata for the public, crawlable pages. The app is a single-page
 * bundle, so without this every URL would report the homepage's title and
 * description to a crawler or a link preview -- which for a section whose
 * entire purpose is search traffic would defeat the point.
 */
export function useSeo({ title, description, path, structuredData, noIndex }: SeoOptions) {
  // Callers rebuild `structuredData` on every render, so the effect keys off
  // its serialised form rather than its identity -- otherwise it would tear
  // down and re-add the JSON-LD script on every keystroke.
  const structuredDataJson = structuredData ? JSON.stringify(structuredData) : null

  useEffect(() => {
    const url = `${SITE_URL}${path}`
    document.title = title
    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    setMeta('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex, follow' : 'index, follow')
    setCanonical(url)

    let script: HTMLScriptElement | null = null
    if (structuredDataJson) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.seo = 'page'
      script.textContent = structuredDataJson
      document.head.appendChild(script)
    }

    return () => {
      document.title = DEFAULTS.title
      setMeta('meta[name="description"]', 'name', 'description', DEFAULTS.description)
      setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow')
      setCanonical(DEFAULTS.canonical)
      script?.remove()
    }
  }, [title, description, path, noIndex, structuredDataJson])
}
