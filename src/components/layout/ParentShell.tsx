import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'

export function ParentShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/parent" className="text-lg font-bold text-brand-700">
            {t('common.appName')}
            <span className="ml-2 text-sm font-medium text-slate-400">Parent</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
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
            <button onClick={() => void signOut()} className="text-slate-500 hover:text-slate-800">
              {t('auth.signOut')}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
