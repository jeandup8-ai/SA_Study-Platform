import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'

export function MarketingShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-brand-700">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base text-white"
              aria-hidden
            >
              📘
            </span>
            {t('common.appName')}
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 sm:flex">
            <a href="#features">{t('nav.subjects')}</a>
            <Link to="/pricing">{t('landing.footer.pricing')}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/sign-in">
              <Button variant="ghost" size="md">
                {t('auth.signIn')}
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="primary" size="md">
                {t('landing.ctaPrimary')}
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">{t('common.appName')}</p>
          <p className="mt-1 max-w-md">{t('landing.footer.tagline')}</p>
          <p className="mt-4 text-xs text-slate-400">{t('landing.disclaimer')}</p>
        </div>
      </footer>
    </div>
  )
}
