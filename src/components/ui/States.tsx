import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { Button } from './Button'

/**
 * Shown when a screen loaded successfully but has nothing to show yet.
 *
 * Distinct from `ErrorState` on purpose: "you have not started anything"
 * and "we could not load your work" must never look the same to a child or
 * to a parent checking on them.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center',
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-volt-50 text-volt-600"
        >
          {icon}
        </span>
      )}
      <p className="font-display text-lg font-bold text-slate-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * Shown when a fetch actually failed. Always offers a retry, because the
 * most common cause on this product is a phone dropping off a patchy
 * mobile connection mid-request, and that fixes itself on a second try.
 */
export function ErrorState({
  onRetry,
  message,
  className,
}: {
  onRetry?: () => void
  message?: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-3xl border border-danger-500/30 bg-danger-50 px-6 py-8 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-danger-600"
      >
        <AlertTriangle size={22} />
      </span>
      <p className="font-display font-bold text-slate-800">{t('common.somethingWentWrong')}</p>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{message}</p>}
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" size="md" onClick={onRetry}>
            {t('common.tryAgain')}
          </Button>
        </div>
      )}
    </div>
  )
}
