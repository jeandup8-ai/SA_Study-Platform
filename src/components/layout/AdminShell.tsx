import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'

const TABS = [
  { to: '/admin', labelKey: 'adminNav.overview', end: true },
  { to: '/admin/curriculum-sources', labelKey: 'adminNav.curriculumSources', end: false },
  { to: '/admin/review-queue', labelKey: 'adminNav.reviewQueue', end: false },
  { to: '/admin/terminology', labelKey: 'adminNav.terminology', end: false },
  { to: '/admin/illustrations', labelKey: 'adminNav.illustrations', end: false },
  { to: '/admin/video-suggestions', labelKey: 'adminNav.videoSuggestions', end: false },
  { to: '/admin/practice-tests', labelKey: 'adminNav.practiceTests', end: false },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    // The admin console is the one application surface that stays dark: it
    // is an internal tool used for long review sessions, and it shares the
    // marketing site's ink canvas rather than the learner app's light one.
    <div className="app-canvas-ink min-h-dvh text-ink-100">
      <header className="glass-bar-ink sticky top-0 z-20 border-b border-ink-700/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <p className="min-w-0 truncate">
            <span className="font-display text-lg font-extrabold tracking-tight text-white">
              {t('common.appName')}
            </span>{' '}
            <span className="rounded-full bg-volt-500/15 px-2 py-0.5 text-xs font-bold text-volt-300">
              {t('admin.title')}
            </span>
          </p>
          <button
            onClick={() => void signOut()}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white"
          >
            {t('auth.signOut')}
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4 pb-3">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-volt-500 text-ink-950'
                    : 'text-ink-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
