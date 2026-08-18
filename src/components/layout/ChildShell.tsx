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
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
          {TABS.map(({ to, icon: Icon, key, end }) => (
            <li key={key} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                    isActive ? 'text-brand-600' : 'text-slate-400',
                  )
                }
              >
                <Icon size={22} strokeWidth={2.25} />
                {t(`nav.${key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
