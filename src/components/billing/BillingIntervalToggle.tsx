import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import type { BillingInterval } from '@/lib/billing/planGroups'

/**
 * Monthly / annual switch above a set of plan cards.
 *
 * A radiogroup rather than two buttons or a checkbox: it is a choice
 * between two mutually exclusive options, which is what arrow keys and
 * `aria-checked` describe, and a parent using a screen reader should hear
 * "annual, radio button, 2 of 2" rather than two unrelated buttons.
 *
 * `tone` exists because this appears on both the light parent app and the
 * dark marketing pages, and there is no tailwind-merge in this project --
 * conflicting utility classes would resolve unpredictably, so each tone
 * spells out its own full set.
 */
export function BillingIntervalToggle({
  value,
  onChange,
  savingLabel,
  tone = 'light',
  className,
}: {
  value: BillingInterval
  onChange: (next: BillingInterval) => void
  /** e.g. "Save up to R1,679" — shown against the annual option. */
  savingLabel?: string
  tone?: 'light' | 'dark'
  className?: string
}) {
  const { t } = useTranslation()
  const options: { key: BillingInterval; label: string }[] = [
    { key: 'monthly', label: t('billing.monthly') },
    { key: 'annual', label: t('billing.annual') },
  ]

  return (
    <div className={clsx('flex flex-col items-center gap-2', className)}>
      <div
        role="radiogroup"
        aria-label={t('billing.intervalLabel')}
        className={clsx(
          'inline-flex rounded-full p-1',
          tone === 'dark' ? 'bg-ink-800/80 ring-1 ring-ink-700' : 'bg-slate-100',
        )}
      >
        {options.map((option) => {
          const selected = value === option.key
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.key)}
              className={clsx(
                'min-h-11 rounded-full px-5 text-sm font-bold transition-colors',
                selected && tone === 'dark' && 'bg-volt-500 text-ink-950',
                selected && tone === 'light' && 'bg-white text-slate-900 shadow-sm',
                !selected && tone === 'dark' && 'text-ink-300 hover:text-white',
                !selected && tone === 'light' && 'text-slate-500 hover:text-slate-800',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {savingLabel && (
        <p
          className={clsx(
            'text-xs font-semibold',
            tone === 'dark' ? 'text-volt-300' : 'text-success-600',
          )}
        >
          {savingLabel}
        </p>
      )}
    </div>
  )
}
