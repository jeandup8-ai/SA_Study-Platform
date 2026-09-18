import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { Menu, X } from 'lucide-react'
import { MarketingButton } from '@/components/marketing'

/** Anchors point at sections of the landing page; paths are real routes. */
const NAV = [
  { key: 'learn', to: '/practice' },
  { key: 'subjects', hash: '#subjects' },
  { key: 'howItWorks', hash: '#how-it-works' },
  { key: 'forParents', hash: '#for-parents' },
  { key: 'pricing', to: '/pricing' },
] as const

/* Full i18n keys rather than fragments joined at render time: a fragment is
   invisible to scripts/check-i18n-keys.mjs, so a typo would only surface as
   raw key text on the live footer. */
const FOOTER_LINKS = [
  { to: '/practice', labelKey: 'm.nav.learn' },
  { to: '/pricing', labelKey: 'm.nav.pricing' },
  { to: '/contact', labelKey: 'm.footer.contact' },
  { to: '/terms', labelKey: 'm.footer.terms' },
  { to: '/privacy', labelKey: 'm.footer.privacy' },
  { to: '/refund-policy', labelKey: 'm.footer.refunds' },
  { to: '/subscription-cancellation', labelKey: 'm.footer.cancel' },
] as const

/**
 * `surface` is what the page's own content sits on.
 *
 * The landing page paints every section itself, so it wants the shell to get
 * out of the way ('dark'). Every other page here -- pricing, the legal pages,
 * the free practice tests -- is light-on-white content, and would be
 * unreadable on the dark chrome. 'light' is therefore the default: a new page
 * that forgets to pass anything still renders legibly.
 */
export function MarketingShell({
  children,
  surface = 'light',
}: {
  children: ReactNode
  surface?: 'dark' | 'light'
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // On-page anchors only exist on the landing page. Anywhere else they would
  // scroll to nothing, so they become links back to the home page instead.
  const onLanding = pathname === '/'

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A full-screen menu over a scrollable page is disorientating; freeze the
  // body while it is open and restore on close.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function hrefFor(item: (typeof NAV)[number]): string {
    if ('to' in item) return item.to
    return onLanding ? item.hash : `/${item.hash}`
  }

  return (
    <div className="min-h-dvh bg-ink-950">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-volt-400 focus:px-4 focus:py-2 focus:font-bold focus:text-ink-950"
      >
        {t('m.skipToContent')}
      </a>

      <header
        className={clsx(
          'sticky top-0 z-40 transition-all duration-300',
          scrolled
            ? 'border-b border-white/10 bg-ink-950/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
            <Logomark />
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              {t('common.appName')}
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.key}
                href={hrefFor(item)}
                className="text-sm font-bold text-ink-200 transition-colors hover:text-white"
              >
                {t(`m.nav.${item.key}`)}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/sign-in"
              className="hidden px-3 text-sm font-bold text-ink-200 transition-colors hover:text-white sm:block"
            >
              {t('auth.signIn')}
            </Link>
            {/* Wrapped rather than given `hidden sm:inline-flex` directly:
                MarketingButton's base classes already set `inline-flex`, and
                without tailwind-merge the two display utilities conflict and
                the button stays visible on small screens, crowding the logo. */}
            <span className="hidden sm:block">
              <MarketingButton to="/sign-up" size="md">
                {t('m.cta.trialShort')}
              </MarketingButton>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={t(menuOpen ? 'm.nav.close' : 'm.nav.open')}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white lg:hidden"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-0 top-[68px] z-40 overflow-y-auto bg-ink-950 lg:hidden">
          <nav className="flex flex-col gap-1 px-4 py-6">
            {NAV.map((item) => (
              <a
                key={item.key}
                href={hrefFor(item)}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-14 items-center rounded-2xl px-4 font-display text-2xl font-extrabold text-white active:bg-white/5"
              >
                {t(`m.nav.${item.key}`)}
              </a>
            ))}
          </nav>
          <div className="safe-bottom space-y-3 border-t border-white/10 px-4 py-6">
            <MarketingButton to="/sign-up" className="w-full" onClick={() => setMenuOpen(false)}>
              {t('m.cta.trial')}
            </MarketingButton>
            <MarketingButton
              to="/sign-in"
              variant="outline"
              className="w-full"
              onClick={() => setMenuOpen(false)}
            >
              {t('auth.signIn')}
            </MarketingButton>
          </div>
        </div>
      )}

      <main id="main" className={surface === 'light' ? 'bg-white text-ink-900' : undefined}>
        {children}
      </main>

      <footer className="border-t border-white/10 bg-ink-950">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <Logomark />
                <span className="font-display text-lg font-extrabold tracking-tight text-white">
                  {t('common.appName')}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-300">{t('landing.footer.tagline')}</p>
            </div>
            <nav className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="font-semibold text-ink-300 transition-colors hover:text-white"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-12 border-t border-white/10 pt-6">
            <p className="text-xs leading-relaxed text-ink-400">{t('landing.disclaimer')}</p>
            <p className="mt-2 text-xs text-ink-500">{t('m.footer.madeIn')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * The logomark: an ascending bar trio inside a rounded tile. It reads as
 * progress rather than as a book or a graduation cap, which is the point --
 * StudyLegends is about a learner moving forward, not about school furniture.
 */
function Logomark() {
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-volt-400 to-volt-600"
      aria-hidden
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="10" width="3.6" height="6.5" rx="1.4" fill="#060B16" />
        <rect x="7.2" y="6" width="3.6" height="10.5" rx="1.4" fill="#060B16" />
        <rect x="12.9" y="1.5" width="3.6" height="15" rx="1.4" fill="#060B16" />
      </svg>
    </span>
  )
}
