import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'

/** Breadcrumb trail, always rooted at the free-practice hub. Keeps the deep
 * test pages navigable for a visitor who arrived straight from a search
 * result and has no idea what the rest of the site holds.
 *
 * `tone` exists because these now sit on the ink hero band, where the old
 * slate greys were close to invisible. */
export function PracticeBreadcrumbs({
  items,
  tone = 'dark',
}: {
  items: { label: string; to?: string }[]
  tone?: 'dark' | 'light'
}) {
  const { t } = useTranslation()
  const base = tone === 'dark' ? 'text-ink-300' : 'text-slate-400'
  const link = tone === 'dark' ? 'hover:text-white' : 'hover:text-slate-600'
  const current = tone === 'dark' ? 'text-white' : 'text-slate-600'

  return (
    <nav
      aria-label="Breadcrumb"
      className={clsx('flex flex-wrap items-center gap-1.5 text-xs font-semibold', base)}
    >
      <Link to="/practice" className={link}>
        {t('practice.breadcrumbRoot')}
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden>/</span>
          {item.to ? (
            <Link to={item.to} className={link}>
              {item.label}
            </Link>
          ) : (
            <span className={current}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
