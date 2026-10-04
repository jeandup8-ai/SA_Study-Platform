import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * What an unknown URL shows.
 *
 * Until this existed, `/pricingg`, a stale bookmark, a mistyped link in a
 * WhatsApp message or a search result for a page that moved all rendered
 * nothing at all -- `<Routes>` matched no route, so React rendered an empty
 * fragment and the visitor got a white page with a working header-less
 * nothing. A blank screen reads as "this product is broken", which is an
 * expensive thing for a mistyped character to say.
 *
 * Kept plain and warm rather than clever. A child who has fat-fingered a URL
 * needs one obvious way back, and a parent evaluating the product needs to
 * see that the thing handles mistakes gracefully.
 */
export function NotFoundPage() {
  const { t } = useTranslation()

  return (
    <main className="app-canvas flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-6xl font-extrabold text-volt-500" aria-hidden>
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-slate-900">
          {t('notFound.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('notFound.body')}</p>

        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-volt-500 px-6 font-bold text-ink-950 hover:bg-volt-400"
          >
            {t('notFound.home')}
          </Link>
          <Link
            to="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-6 font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t('notFound.keepLearning')}
          </Link>
        </div>
      </div>
    </main>
  )
}
