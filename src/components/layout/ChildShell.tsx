import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, BookOpen, ScanLine, TrendingUp, GraduationCap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

const TABS = [
  { to: '/app', icon: Home, key: 'dashboard', end: true },
  { to: '/app/subjects', icon: BookOpen, key: 'subjects', end: false },
  { to: '/app/scan', icon: ScanLine, key: 'scan', end: false },
  { to: '/app/progress', icon: TrendingUp, key: 'progress', end: false },
  { to: '/app/exam', icon: GraduationCap, key: 'exam', end: false },
] as const

export function ChildShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="app-canvas flex min-h-dvh flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <nav className="safe-bottom glass-bar fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
          {TABS.map(({ to, icon: Icon, key, end }) => (
            <li key={key} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold',
                    'transition-colors',
                    // The active tab gets a tinted pill as well as colour.
                    // Colour alone is not a sufficient indicator -- this is
                    // the one piece of persistent navigation in the app and
                    // it has to be readable without colour vision.
                    isActive ? 'bg-volt-50 text-volt-700' : 'text-slate-400 hover:text-slate-600',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} strokeWidth={isActive ? 2.6 : 2.1} />
                    {t(`nav.${key}`)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
