import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <p className="text-lg font-bold">
            {t('common.appName')} <span className="text-slate-500">{t('admin.title')}</span>
          </p>
          <button onClick={() => void signOut()} className="text-sm text-slate-400 hover:text-slate-100">
            {t('auth.signOut')}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
