import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'

function navClass({ isActive }: { isActive: boolean }): string {
  return clsx(
    'rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
    isActive ? 'bg-volt-50 text-volt-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  )
}

export function ParentShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { isAdmin } = useIsAdmin()

  return (
    <div className="app-canvas min-h-dvh">
      <header className="glass-bar sticky top-0 z-20 border-b border-slate-200/80">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/parent" className="flex min-w-0 items-baseline gap-2">
              <span className="font-display truncate text-lg font-extrabold tracking-tight text-slate-900">
                {t('common.appName')}
              </span>
              <span className="shrink-0 rounded-full bg-lilac-100 px-2 py-0.5 text-xs font-bold text-lilac-600">
                {t('nav.parent')}
              </span>
            </Link>
            <button
              onClick={() => void signOut()}
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              {t('auth.signOut')}
            </button>
          </div>
          <nav className="mt-2 flex flex-wrap items-center gap-1">
            <NavLink to="/parent" end className={navClass}>
              {t('nav.progress')}
            </NavLink>
            <NavLink to="/parent/subscription" className={navClass}>
              {t('parent.manageSubscription')}
            </NavLink>
            <NavLink to="/parent/settings" className={navClass}>
              {t('parent.settingsTitle')}
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                {t('admin.title')}
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
