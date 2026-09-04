import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/curriculum-sources', label: 'Curriculum sources', end: false },
  { to: '/admin/review-queue', label: 'Review queue', end: false },
  { to: '/admin/terminology', label: 'Terminology', end: false },
  { to: '/admin/illustrations', label: 'Illustrations', end: false },
] as const

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <p className="min-w-0 truncate text-lg font-bold">
            {t('common.appName')} <span className="text-slate-500">{t('admin.title')}</span>
          </p>
          <button
            onClick={() => void signOut()}
            className="shrink-0 text-sm text-slate-400 hover:text-slate-100"
          >
            {t('auth.signOut')}
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 pb-2">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
