import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/** Breadcrumb trail, always rooted at the free-practice hub. Keeps the deep
 * test pages navigable for a visitor who arrived straight from a search
 * result and has no idea what the rest of the site holds. */
export function PracticeBreadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const { t } = useTranslation()
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
      <Link to="/practice" className="hover:text-slate-600">
        {t('practice.breadcrumbRoot')}
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden>/</span>
          {item.to ? (
            <Link to={item.to} className="hover:text-slate-600">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-600">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
