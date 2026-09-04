import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export function ParentShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { isAdmin } = useIsAdmin()

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link to="/parent" className="flex min-w-0 items-baseline gap-2 text-lg font-bold text-brand-700">
              <span className="truncate">{t('common.appName')}</span>
              <span className="shrink-0 text-sm font-medium text-slate-400">Parent</span>
            </Link>
            <button
              onClick={() => void signOut()}
              className="shrink-0 text-sm text-slate-500 hover:text-slate-800"
            >
              {t('auth.signOut')}
            </button>
          </div>
          <nav className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium">
            <NavLink
              to="/parent"
              end
              className={({ isActive }) =>
                clsx(isActive ? 'text-brand-700' : 'text-slate-500')
              }
            >
              {t('parent.dashboardTitle', { name: '' }).split(' ')[0] || 'Progress'}
            </NavLink>
            <NavLink
              to="/parent/subscription"
              className={({ isActive }) =>
                clsx(isActive ? 'text-brand-700' : 'text-slate-500')
              }
            >
              {t('parent.manageSubscription')}
            </NavLink>
            <NavLink
              to="/parent/settings"
              className={({ isActive }) =>
                clsx(isActive ? 'text-brand-700' : 'text-slate-500')
              }
            >
              {t('parent.settingsTitle')}
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  clsx(isActive ? 'text-brand-700' : 'text-slate-500')
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
